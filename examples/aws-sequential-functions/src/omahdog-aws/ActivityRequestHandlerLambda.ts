import { SNSEvent } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';

import { FlowContext, AsyncResponse, RequestRouter, HandlerFactory, IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { ExchangeCallingContext, ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';

export class ActivityRequestHandlerLambda {

    // TODO 27May20: The following two will be resources
    exchangeMessagePublisher: IExchangeMessagePublisher;
    functionInstanceRepository: IFunctionInstanceRepository;

    private readonly handlerType: new () => IActivityRequestHandlerBase;
    private readonly requestRouter: RequestRouter;
    private readonly handlerFactory: HandlerFactory;

    constructor(handlerType: new () => IActivityRequestHandlerBase, requestRouter: RequestRouter, handlerFactory: HandlerFactory) {

        this.handlerType = handlerType;        
        this.requestRouter = requestRouter;
        this.handlerFactory = handlerFactory;
    }

    async handle(event: SNSEvent | ExchangeRequestMessage): Promise<ExchangeResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

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
                    message.callingContext.flowCorrelationId, this.requestRouter, this.handlerFactory);
    
            try {
                response = await flowContext.handleRequest(this.handlerType, message.request);
            } catch (error) {
                console.error(`Error handling response: ${error.message}\n${error.stack}`);
                response = new ErrorResponse(error);
            }
    
        } else {
    
            const functionInstance = await this.functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);
    
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
    
            const flowContext = FlowContext.newResumeContext(flowInstance, this.requestRouter, this.handlerFactory);
    
            try {
                response = await flowContext.handleResponse(this.handlerType, message.response);
            } catch (error) {
                console.error(`Error handling response: ${error.message}\n${error.stack}`);
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
    
            await this.functionInstanceRepository.store(functionInstance);
    
        } else {

            const responseMessage: ExchangeResponseMessage = {
                callingContext: callingContext,
                response: response
            };

            if (!isDirectRequest) {    
                await this.exchangeMessagePublisher.publishResponse(callingContext.handlerTypeName, responseMessage);
            }
    
            if (resumeCount > 0) {
                // TODO 18May20: Perhaps we want to leave a trace, could have a TTL on the table
                console.log(`DELETE flowInstanceId: ${message.callingContext.flowInstanceId}`);
                await this.functionInstanceRepository.delete(message.callingContext.flowInstanceId);
            }

            if (isDirectRequest && (resumeCount === 0)) {
                console.log(`return: ${JSON.stringify(responseMessage)}`);
                return responseMessage;
            } 
        }
    }
}
 
