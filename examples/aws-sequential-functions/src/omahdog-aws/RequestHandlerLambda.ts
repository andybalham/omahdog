import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase, IActivityRequestHandler, getRequestHandlers, FlowRequestContext } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { FlowRequestMessage, FlowResponseMessage, FlowResponseContext } from './FlowMessage';
import { LambdaBase } from './LambdaBase';
import { TemplateReference } from './TemplateReferences';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IConfigurationValue } from './ConfigurationValues';
import { Type } from '../omahdog/Type';

class RequestHandlerLambdaServices {
    responsePublisher?: IExchangeMessagePublisher
    functionInstanceRepository?: IFunctionInstanceRepository
}

class RequestHandlerLambdaParameters {
    requestTopic?: TemplateReference
}

export abstract class RequestHandlerLambdaBase extends LambdaBase {

    parameters = new RequestHandlerLambdaParameters
    services = new RequestHandlerLambdaServices

    enableSNS: boolean;
    requestType: Type<any>;
    handlerType: Type<IActivityRequestHandlerBase>;

    abstract getEvents(): any[];

    abstract handle(event: SNSEvent | FlowRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<FlowResponseMessage | void>;
}

export class RequestHandlerLambda<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>> extends RequestHandlerLambdaBase {

    constructor(functionReference: TemplateReference, 
        requestType: Type<TReq>, responseType: Type<TRes>, handlerType: Type<THan>, 
        initialise?: (lambda: RequestHandlerLambda<TReq, TRes, THan>) => void) {

        // TODO 20Jun20: How can we add instance-specific configuration for the handler? E.g. No triggering by message
        
        super(functionReference.name ?? '<unknown>');

        this.requestType = requestType;
        this.handlerType = handlerType;
        
        if (initialise !== undefined) {
            initialise(this);
        }
    }

    getEvents(): any[] {

        const events = [];

        if (this.enableSNS) {

            const requestEvent = {
                Type: 'SNS',
                Properties: {
                    Topic: undefined,
                    FilterPolicy: {
                        MessageType: new Array<string>()
                    }
                },
            };
    
            requestEvent.Properties.Topic = this.parameters.requestTopic?.instance;
            requestEvent.Properties.FilterPolicy.MessageType = [`${this.requestType.name}:Handler`];
    
            events.push(requestEvent);                
        }

        return events;
    }
    
    validate(baseTemplate: any, requestRouter: RequestRouter, handlerFactory: HandlerFactory): string[] {

        const errorMessages = new Array<string>();
        
        if (this.enableSNS) {
            if (this.parameters.requestTopic === undefined) errorMessages.push('this.parameters.requestTopic === undefined');
            if (this.services.responsePublisher === undefined) errorMessages.push('this.services.responsePublisher === undefined');
        }
        
        if (this.hasAsyncHandler(requestRouter, handlerFactory)) {
            if (this.services.functionInstanceRepository === undefined) errorMessages.push('this.services.functionInstanceRepository === undefined');
        }

        return errorMessages;
    }

    hasAsyncHandler(requestRouter: RequestRouter, handlerFactory: HandlerFactory): boolean {
        const handlers = getRequestHandlers(this.handlerType, handlerFactory, requestRouter);
        const hasAsyncHandler = Array.from(handlers.values()).some((h: any) => h.isAsync);
        return hasAsyncHandler;
    }

    async handle(event: SNSEvent | FlowRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<FlowResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        let message: FlowRequestMessage | FlowResponseMessage;
        let isDirectRequest: boolean;

        if ('Records' in event) {

            isDirectRequest = false;

            const snsMessage = event.Records[0].Sns;
            message = JSON.parse(snsMessage.Message);
        
            // TODO 02May20: Remove this temporary code
            if (snsMessage.Message.includes('6666') && (this.handlerType.name === 'SumNumbersHandler')) {
                throw new Error('Non-handler error in LambdaActivityRequestHandler!');
            }
                
        } else {

            isDirectRequest = true;            
            message = event;

        }

        console.log(`message: ${JSON.stringify(message)}`);
    
        let response: any;
        let flowResponseContext: FlowResponseContext | undefined;
        let resumeCount: number;
    
        if ('request' in message) {
            
            // Handle request

            flowResponseContext = message.responseContext;

            resumeCount = 0;
    
            const flowContext = FlowContext.newRequestContext(message.requestContext, requestRouter, handlerFactory);
    
            try {
                
                response = await flowContext.handleRequest(this.handlerType, message.request);

            } catch (error) {
                console.error(`Error handling response: ${error.message}\n${error.stack}`);
                response = new ErrorResponse(error);
            }
    
        } else {
    
            // Handle response
            
            if (message.responseContext === undefined) throw new Error('message.responseContext === undefined');
            if (this.services.functionInstanceRepository === undefined) throw new Error('this.services.functionInstanceRepository === undefined');

            const functionInstance = await this.services.functionInstanceRepository.retrieve(message.responseContext.flowInstanceId);
    
            if (functionInstance === undefined) throw new Error('functionInstance was undefined');

            if (functionInstance.flowRequestId !== message.responseContext.flowRequestId) {
                // TODO 26Apr20: Do something more in this case where request is not as we expect
                console.error(`The requestId does not match what was expected. Expected: ${functionInstance.flowRequestId}, Actual: ${message.responseContext.flowRequestId}`);
                return;
            }
    
            flowResponseContext = functionInstance.flowResponseContext;

            resumeCount = functionInstance.resumeCount + 1;        
            if (resumeCount > 100) throw new Error(`resumeCount exceeded threshold: ${resumeCount}`);
    
            const flowInstance = functionInstance.flowInstance;
    
            const flowContext = FlowContext.newResumeContext(flowInstance, requestRouter, handlerFactory);
    
            try {
                response = await flowContext.handleResponse(this.handlerType, message.response);
            } catch (error) {
                console.error(`Error handling response: ${error.message}\n${error.stack}`);
                response = new ErrorResponse(error);
            }
        }
    
        const responseMessage: FlowResponseMessage = {
            responseContext: flowResponseContext,
            response: response
        };
    
        if ('AsyncResponse' in response) {
    
            const functionInstance: FunctionInstance = {
                flowInstance: response.getFlowInstance(),
                flowRequestId: response.requestId,
                flowResponseContext: flowResponseContext,
                resumeCount: resumeCount
            };
    
            console.log(`functionInstance: ${JSON.stringify(functionInstance)}`);
    
            if (this.services.functionInstanceRepository === undefined) throw new Error('this.services.functionInstanceRepository === undefined');

            await this.services.functionInstanceRepository.store(functionInstance);

        } else {

            if (!isDirectRequest) {
                
                if (this.services.responsePublisher === undefined) throw new Error('this.services.responsePublisher === undefined');
                if (flowResponseContext === undefined) throw new Error('flowResponseContext === undefined');

                await this.services.responsePublisher.publishResponse(flowResponseContext.flowHandlerTypeName, responseMessage);
            }

            if (resumeCount > 0) {

                // TODO 18May20: Perhaps we want to leave a trace, could have a TTL on the table
                if (message.responseContext === undefined) throw new Error('message.responseContext === undefined');
                if (this.services.functionInstanceRepository === undefined) throw new Error('this.services.functionInstanceRepository === undefined');

                console.log(`DELETE flowInstanceId: ${message.responseContext.flowInstanceId}`);
                await this.services.functionInstanceRepository.delete(message.responseContext.flowInstanceId);
            }
    
        }

        if (isDirectRequest) {
            console.log(`return: ${JSON.stringify(responseMessage)}`);
            return responseMessage;
        } 
    }
}
 
