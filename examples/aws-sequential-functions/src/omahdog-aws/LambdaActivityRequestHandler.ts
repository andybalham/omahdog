import { SNSEvent } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';

import { FlowContext, AsyncResponse, RequestRouter, HandlerFactory, IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { AsyncCallingContext, AsyncRequestMessage, AsyncResponseMessage } from './AsyncExchange';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';

export class LambdaActivityRequestHandler {

    private readonly _requestRouter: RequestRouter;
    private readonly _handlerFactory: HandlerFactory;
    private readonly _exchangeMessagePublisher: IExchangeMessagePublisher;
    private readonly _functionInstanceRepository: IFunctionInstanceRepository;

    constructor(requestRouter: RequestRouter, handlerFactory: HandlerFactory, 
        exchangeMessagePublisher: IExchangeMessagePublisher, functionInstanceRepository: IFunctionInstanceRepository) {

        this._requestRouter = requestRouter;
        this._handlerFactory = handlerFactory;
        this._exchangeMessagePublisher = exchangeMessagePublisher;
        this._functionInstanceRepository = functionInstanceRepository;
    }

    async handle(HandlerType: new () => IActivityRequestHandlerBase, event: SNSEvent | AsyncRequestMessage): Promise<AsyncResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        let message: AsyncRequestMessage | AsyncResponseMessage;
        let isDirectRequest: boolean;

        if ('Records' in event) {

            isDirectRequest = false;

            const snsMessage = event.Records[0].Sns;
            message = JSON.parse(snsMessage.Message);
        
            // TODO 02May20: Remove this temporary code
            if (snsMessage.Message.includes('6666') && (HandlerType.name === 'SumNumbersHandler')) {
                throw new Error('Non-handler error in LambdaActivityRequestHandler!');
            }
                
        } else {

            isDirectRequest = true;            
            message = event;

        }

        console.log(`message: ${JSON.stringify(message)}`);
    
        let response: any;
        let callingContext: AsyncCallingContext;
        let resumeCount: number;
    
        const handler = this._handlerFactory.newHandler(HandlerType);

        if ('request' in message) {
            
            callingContext = message.callingContext;
            resumeCount = 0;
    
            const flowContext = FlowContext.newCorrelatedContext(message.callingContext.flowCorrelationId);
            flowContext.requestRouter = this._requestRouter;
            flowContext.handlerFactory = this._handlerFactory;
    
            try {
                response = await handler.handle(flowContext, message.request);                    
            } catch (error) {
                response = new ErrorResponse(error);
            }
    
        } else {
    
            const functionInstance = await this._functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);
    
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
    
            const flowContext = FlowContext.newResumeContext(flowInstance, message.response);
            flowContext.requestRouter = this._requestRouter;
            flowContext.handlerFactory = this._handlerFactory;
    
            try {
                response = await handler.handle(flowContext);
            } catch (error) {
                response = new ErrorResponse(error);
            }
        }
    
        if ('AsyncResponse' in response) {
    
            const functionInstance: FunctionInstance = {
                callingContext: callingContext,
                flowInstance: response.getFlowInstance(),
                requestId: response.requestId,
                resumeCount: resumeCount
            };
    
            console.log(`functionInstance: ${JSON.stringify(functionInstance)}`);
    
            await this._functionInstanceRepository.store(functionInstance);
    
        } else {

            const responseMessage: AsyncResponseMessage = {
                callingContext: callingContext,
                response: response
            };

            if (!isDirectRequest) {    
                await this._exchangeMessagePublisher.publishResponse(callingContext.flowTypeName, responseMessage);
            }
    
            if (resumeCount > 0) {
                console.log(`DELETE flowInstanceId: ${responseMessage.callingContext.flowInstanceId}`);
                await this._functionInstanceRepository.delete(responseMessage.callingContext.flowInstanceId);
            }

            if (isDirectRequest && (resumeCount === 0)) {
                console.log(`return: ${JSON.stringify(responseMessage)}`);
                return responseMessage;
            } 
        }
    }
}
 
