import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase, IActivityRequestHandler } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { ExchangeCallingContext, ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { throwErrorIfInvalid } from './samTemplateFunctions';
import { LambdaBase } from './LambdaBase';
import { TemplateReference } from './TemplateReferences';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IConfigurationValue } from './ConfigurationValues';

class RequestHandlerLambdaServices {
    responsePublisher: IExchangeMessagePublisher
    functionInstanceRepository: IFunctionInstanceRepository
}

class RequestHandlerLambdaParameters {
    requestTopic?: TemplateReference
}

export abstract class RequestHandlerLambdaBase extends LambdaBase {

    parameters = new RequestHandlerLambdaParameters
    services = new RequestHandlerLambdaServices

    requestType: new () => any;
    handlerType: new () => IActivityRequestHandlerBase;

    abstract getEvents(): any[];

    abstract handle(event: SNSEvent | ExchangeRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<ExchangeResponseMessage | void>;
}

export class RequestHandlerLambda<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>> extends RequestHandlerLambdaBase {

    constructor(functionReference: TemplateReference, 
        requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
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

        const responseEvent = {
            Type: 'SNS',
            Properties: {
                Topic: undefined,
                FilterPolicy: {
                    MessageType: new Array<string>()
                }
            },
        };

        responseEvent.Properties.Topic = this.parameters.requestTopic?.instance;
        responseEvent.Properties.FilterPolicy.MessageType = [`${this.requestType.name}:Handler`];

        return [responseEvent];
    }
    
    validate(): string[] {

        const errorMessages = new Array<string>();
        
        // TODO 16Jun20: We only need the following if we are to enable invocation from a message, e.g. from an explicit flag
        if (this.parameters.requestTopic === undefined) errorMessages.push('this.parameters.requestTopic === undefined');
        
        // TODO 16Jun20: Can we derive if the following is required? E.g. do we have any triggers? I am not sure we would want to introspect on each handle() call
        if (this.services.functionInstanceRepository === undefined) errorMessages.push('this.services.functionInstanceRepository === undefined');
        if (this.services.responsePublisher === undefined) errorMessages.push('this.services.responsePublisher === undefined');

        return errorMessages;
    }

    async handle(event: SNSEvent | ExchangeRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<ExchangeResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        throwErrorIfInvalid(this, () => RequestHandlerLambda.name);

        let message: ExchangeRequestMessage | ExchangeResponseMessage;
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
        let callingContext: ExchangeCallingContext;
        let resumeCount: number;
    
        if ('request' in message) {
            
            callingContext = message.callingContext;
            resumeCount = 0;
    
            const flowContext = 
                FlowContext.newCorrelatedContext(
                    message.callingContext.flowCorrelationId, requestRouter, handlerFactory);
    
            try {
                response = await flowContext.handleRequest(this.handlerType, message.request);
            } catch (error) {
                console.error(`Error handling response: ${error.message}\n${error.stack}`);
                response = new ErrorResponse(error);
            }
    
        } else {
    
            const functionInstance = await this.services.functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);
    
            if (functionInstance === undefined) throw new Error('functionInstance was undefined');

            if (functionInstance.requestId !== message.callingContext.requestId) {
                // TODO 26Apr20: Do something more in this case where request is not as we expect
                console.error(`The requestId does not match what was expected. Expected: ${functionInstance.requestId}, Actual: ${message.callingContext.requestId}`);
                return;
            }
    
            callingContext = functionInstance.callingContext;
            
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
    
        const responseMessage: ExchangeResponseMessage = {
            callingContext: callingContext,
            response: response
        };
    
        if ('AsyncResponse' in response) {
    
            const functionInstance: FunctionInstance = {
                callingContext: callingContext,
                flowInstance: response.getFlowInstance(),
                requestId: response.requestId,
                resumeCount: resumeCount
            };
    
            console.log(`functionInstance: ${JSON.stringify(functionInstance)}`);
    
            await this.services.functionInstanceRepository.store(functionInstance);

        } else {

            if (!isDirectRequest) {
                await this.services.responsePublisher.publishResponse(callingContext.handlerTypeName, responseMessage);
            }

            if (resumeCount > 0) {
                // TODO 18May20: Perhaps we want to leave a trace, could have a TTL on the table
                console.log(`DELETE flowInstanceId: ${message.callingContext.flowInstanceId}`);
                await this.services.functionInstanceRepository.delete(message.callingContext.flowInstanceId);
            }
    
        }

        if (isDirectRequest) {
            console.log(`return: ${JSON.stringify(responseMessage)}`);
            return responseMessage;
        } 
    }
}
 
