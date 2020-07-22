import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase, IActivityRequestHandler, getRequestHandlers, CallContext, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { FlowRequestMessage, FlowResponseMessage } from './FlowMessage';
import { LambdaBase } from './LambdaBase';
import { TemplateReference } from './TemplateReferences';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IConfigurationValue, ConstantValue, EnvironmentVariable } from './ConfigurationValues';
import { Type } from '../omahdog/Type';
import { Environment } from 'aws-sdk/clients/lambda';

class RequestHandlerLambdaServices {
    responsePublisher?: IExchangeMessagePublisher
    functionInstanceRepository?: IFunctionInstanceRepository
}

class RequestHandlerLambdaParameters {
    requesterId?: EnvironmentVariable
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
            if (this.parameters.requesterId === undefined) errorMessages.push('this.parameters.requesterId === undefined');
            if (this.services.functionInstanceRepository === undefined) errorMessages.push('this.services.functionInstanceRepository === undefined');
        }

        return errorMessages;
    }

    hasAsyncHandler(requestRouter: RequestRouter, handlerFactory: HandlerFactory): boolean {
        // TODO 21Jul20: This isn't going to be 100%, as a Lambda proxy could return an async response
        const handlers = getRequestHandlers(this.handlerType, handlerFactory, requestRouter);
        const hasAsyncHandler = Array.from(handlers.values()).some((h: any) => h.isAsync);
        return hasAsyncHandler;
    }

    async handle(event: SNSEvent | FlowRequestMessage | FlowResponseMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<FlowResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        let message: FlowRequestMessage | FlowResponseMessage;
        let isQueuedRequest: boolean;

        if ('Records' in event) {

            isQueuedRequest = true;

            const snsMessage = event.Records[0].Sns;
            message = JSON.parse(snsMessage.Message);
        
            // TODO 02May20: Remove this temporary code
            if (snsMessage.Message.includes('6666') && (this.handlerType.name === 'SumNumbersHandler')) {
                throw new Error('Non-handler error in LambdaActivityRequestHandler!');
            }
                
        } else {

            isQueuedRequest = false;
            message = event;

        }

        console.log(`message: ${JSON.stringify(message)}`);
    
        let callContext: CallContext;
        let requesterId: string;
        let requestId: string;
        let resumeCount: number;
        let response: any;
    
        if ('request' in message) {
            
            // Handle request

            ({ callContext, requesterId, requestId, resumeCount, response } = 
                await this.handleRequestMessage(message, requestRouter, handlerFactory, response));
    
        } else {
    
            // Handle response
            
            const functionInstance = await this.getFunctionInstance(message);
    
            if (functionInstance === undefined) {
                console.warn(`An instance could not be found for the requestId: ${message.requestId}`);
                return;
            }
    
            ({ callContext, requesterId, requestId, resumeCount, response } = 
                await this.handleResponseMessage(functionInstance, message, requestRouter, handlerFactory));
        }
    
        // If we got an async response, then we need to store an instance for when we get a real response

        const isAsyncResponse = 'AsyncResponse' in response;

        if (isAsyncResponse) {
            await this.storeFunctionInstance(callContext, requesterId, requestId, resumeCount, response);
        }

        // Send the response back, either directly or via a message if a message was received

        const responseMessage: FlowResponseMessage = {
            requestId: requestId,
            response: response
        };
    
        console.log(`return: ${JSON.stringify(responseMessage)}`);

        if (isQueuedRequest && !isAsyncResponse && (requesterId !== undefined)) {
            if (this.services.responsePublisher === undefined) throw new Error('this.services.responsePublisher === undefined');        
            await this.services.responsePublisher.publishResponse(requesterId, responseMessage);    
        }

        return responseMessage;
    }

    private async storeFunctionInstance(callContext: CallContext, requesterId: string, requestId: string, resumeCount: number, response: any): Promise<void> {

        const functionInstance: FunctionInstance = {
            callContext: callContext,
            requesterId: requesterId,
            requestId: requestId,
            resumeCount: resumeCount,
            stackFrames: (response as AsyncResponse).stackFrames
        };

        console.log(`functionInstance: ${JSON.stringify(functionInstance)}`);

        if (this.services.functionInstanceRepository === undefined)
            throw new Error('this.services.functionInstanceRepository === undefined');

        await this.services.functionInstanceRepository.store((response as AsyncResponse).requestId, functionInstance);
    }

    private async handleResponseMessage(functionInstance: FunctionInstance, message: FlowResponseMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<any> {

        const resumeCount = functionInstance.resumeCount + 1;

        if (resumeCount > 100)
            throw new Error(`resumeCount exceeded threshold: ${resumeCount}`);

        const flowContext = 
            FlowContext.newResumeContext(
                functionInstance.callContext, this.getRequesterId(), functionInstance.stackFrames, requestRouter, handlerFactory);

        let response: any;

        try {

            response = await flowContext.handleResponse(this.handlerType, message.response);

        }
        catch (error) {
            console.error(`Error handling response: ${error.message}\n${error.stack}`);
            response = new ErrorResponse(error);
        }

        return { 
            callContext: functionInstance.callContext, 
            requesterId: functionInstance.requesterId, 
            requestId: functionInstance.requestId, 
            resumeCount, 
            response 
        };
    }

    private async getFunctionInstance(message: FlowResponseMessage): Promise<FunctionInstance | undefined> {

        if (this.services.functionInstanceRepository === undefined)
            throw new Error('this.services.functionInstanceRepository === undefined');

        const functionInstance = await this.services.functionInstanceRepository.retrieve(message.requestId);

        return functionInstance;
    }

    private async handleRequestMessage(message: FlowRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory, response: any): Promise<any> {

        const flowContext = 
            FlowContext.newRequestContext(
                message.callContext, this.getRequesterId(), requestRouter, handlerFactory);

        try {

            response = await flowContext.handleRequest(this.handlerType, message.request);

        }
        catch (error) {
            console.error(`Error handling response: ${error.message}\n${error.stack}`);
            response = new ErrorResponse(error);
        }

        return { callContext: message.callContext, requesterId: message.requesterId, requestId: message.requestId, resumeCount: 0, response };
    }

    private getRequesterId(): string {
        return this.parameters.requesterId?.evaluate() ?? 'undefined';
    }
}
 
