import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase, IActivityRequestHandler, getRequestHandlers, CallContext, AsyncResponse } from '../omahdog/FlowContext';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { FlowRequestMessage, FlowResponseMessage } from './FlowMessage';
import { LambdaBase } from './LambdaBase';
import { TemplateReference } from './TemplateReferences';
import { IResponseMessagePublisher } from './IResponseMessagePublisher';
import { Type } from '../omahdog/Type';

class RequestHandlerLambdaParameters {
    requestTopic?: TemplateReference
}

class RequestHandlerLambdaServices {
    responsePublisher?: IResponseMessagePublisher
    functionInstanceRepository?: IFunctionInstanceRepository
}

export abstract class RequestHandlerLambdaBase extends LambdaBase {

    parameters = new RequestHandlerLambdaParameters
    services = new RequestHandlerLambdaServices

    requestType: Type<any>;
    handlerType: Type<IActivityRequestHandlerBase>;

    abstract getEvents(): any[];

    abstract handle(event: SNSEvent | FlowRequestMessage | FlowResponseMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<any | void>;

    getFunctionName(): string {
        return process.env['FUNCTION_NAME'] ?? 'undefined';
    }
}

export class RequestHandlerLambda<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>> extends RequestHandlerLambdaBase {

    constructor(functionReference: TemplateReference, 
        requestType: Type<TReq>, responseType: Type<TRes>, handlerType: Type<THan>, 
        initialise?: (lambda: RequestHandlerLambda<TReq, TRes, THan>) => void) {

        super(functionReference.name ?? '<unknown>');

        this.requestType = requestType;
        this.handlerType = handlerType;
        
        if (initialise !== undefined) {
            initialise(this);
        }
    }

    getEvents(): any[] {

        const events = [];

        if (this.parameters.requestTopic !== undefined) {

            const requestEvent = {
                Type: 'SNS',
                Properties: {
                    Topic: this.parameters.requestTopic.instance
                },
            };
    
            events.push(requestEvent);                
        }

        return events;
    }
    
    validate(baseTemplate: any, requestRouter: RequestRouter, handlerFactory: HandlerFactory): string[] {

        const errorMessages = new Array<string>();
        
        if (this.parameters.requestTopic !== undefined) {
            if (this.services.responsePublisher === undefined) errorMessages.push('this.services.responsePublisher === undefined');
        }
        
        if (this.hasAsyncHandler(requestRouter, handlerFactory)) {
            if (this.services.functionInstanceRepository === undefined) errorMessages.push('this.services.functionInstanceRepository === undefined');
        }

        return errorMessages;
    }

    hasAsyncHandler(requestRouter: RequestRouter, handlerFactory: HandlerFactory): boolean {
        
        const handlers = getRequestHandlers(this.handlerType, handlerFactory, requestRouter);
        
        const hasAsyncHandler = 
            Array
                .from(handlers.values())
                .some((h: any) => ('getEvents' in h) && (h.getEvents(null).length > 0));

        return hasAsyncHandler;
    }

    async handle(event: SNSEvent | FlowRequestMessage | FlowResponseMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<TRes | ErrorResponse | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        if ('Records' in event) {
            await this.handleSnsEventRecords(event, requestRouter, handlerFactory);
            return;                
        }

        return await this.handleFlowMessage(event, false, requestRouter, handlerFactory);
    }

    private async handleSnsEventRecords(event: SNSEvent, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<void> {

        for (let index = 0; index < event.Records.length; index++) {

            const snsMessage = event.Records[index].Sns;
            const message = JSON.parse(snsMessage.Message);

            // TODO 02May20: Remove this temporary code
            if (snsMessage.Message.includes('6666') && (this.handlerType.name === 'SumNumbersHandler')) {
                throw new Error('Non-handler error in LambdaActivityRequestHandler!');
            }

            await this.handleFlowMessage(message, true, requestRouter, handlerFactory);
        }
    }

    private async handleFlowMessage(inboundMessage: FlowRequestMessage | FlowResponseMessage, isAsyncInboundRequest: boolean,
        requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<TRes | ErrorResponse | void> {

        console.log(`message: ${JSON.stringify(inboundMessage)}`);
    
        let callContext: CallContext;
        let callbackId: string;
        let requestId: string;
        let resumeCount: number;
        let response: any;        
    
        if ('request' in inboundMessage) {
            
            // Handle request

            ({ callContext, callbackId: callbackId, requestId, resumeCount, response: response } = 
                await this.handleRequestMessage(inboundMessage, requestRouter, handlerFactory, response));
    
        } else {
    
            // Handle response
            
            const functionInstance = await this.getFunctionInstance(inboundMessage);
    
            if (functionInstance === undefined) {
                console.warn(`An instance could not be found for the requestId: ${inboundMessage.requestId}`);
                return;
            }

            ({ callContext, callbackId: callbackId, requestId, resumeCount, response: response } = 
                await this.handleResponseMessage(functionInstance, inboundMessage, requestRouter, handlerFactory));
        }
    
        const isAsyncResponse = ('AsyncResponse' in response);
        
        if (isAsyncResponse) {
            
            await this.storeFunctionInstance(callContext, callbackId, requestId, resumeCount, response);

            if (isAsyncInboundRequest) {
                return;
            }

            if (resumeCount === 0) {
                console.error('Asynchronous response received, when function invoked synchronously');
                return new ErrorResponse(new Error('Asynchronous response received, when function invoked synchronously'));
            }

        } else {
            
            if (isAsyncInboundRequest) {                
                await this.publishFinalResponse(requestId, response, callbackId);    
                return;
            }

            if (resumeCount === 0) {
                console.log(`return: ${JSON.stringify(response)}`);
                return response;
            }
        }
    }

    private async publishFinalResponse(requestId: string, response: any, callbackId: string): Promise<void> {

        if (callbackId === undefined) {
            console.log('callbackId === undefined, so no final response to publish');
            return;
        }

        const responseMessage: FlowResponseMessage = {
            requestId: requestId,
            response: response
        };

        console.log(`publish: ${JSON.stringify(responseMessage)}`);

        if (this.services.responsePublisher === undefined)
            throw new Error('this.services.responsePublisher === undefined');

        await this.services.responsePublisher.publishResponse(callbackId, responseMessage);
    }

    private async storeFunctionInstance(callContext: CallContext, callbackId: string, requestId: string, resumeCount: number, response: any): Promise<void> {

        const functionInstance: FunctionInstance = {
            callContext: callContext,
            callbackId: callbackId,
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
                functionInstance.callContext, this.getFunctionName(), functionInstance.stackFrames, requestRouter, handlerFactory);

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
            callbackId: functionInstance.callbackId, 
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
                message.callContext, this.getFunctionName(), requestRouter, handlerFactory);

        try {

            response = await flowContext.handleRequest(this.handlerType, message.request);

        }
        catch (error) {
            console.error(`Error handling response: ${error.message}\n${error.stack}`);
            response = new ErrorResponse(error);
        }

        return { callContext: message.callContext, callbackId: message.callbackId, requestId: message.requestId, resumeCount: 0, response };
    }
}
 
