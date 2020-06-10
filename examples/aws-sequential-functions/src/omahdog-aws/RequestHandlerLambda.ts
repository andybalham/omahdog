import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { NullFunctionInstanceRepository, FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { ExchangeCallingContext, ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IExchangeMessagePublisher, NullExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { LambdaBase, FunctionReference, validateServices, throwErrorIfInvalid } from './SAMTemplate';

class RequestHandlerLambdaServices {
    responsePublisher: IExchangeMessagePublisher
    functionInstanceRepository: IFunctionInstanceRepository
}

export class RequestHandlerLambda extends LambdaBase {

    services: RequestHandlerLambdaServices

    readonly requestHandlerType: new () => IActivityRequestHandlerBase;

    constructor(functionReference: FunctionReference, initialise?: (lambda: RequestHandlerLambda) => void) {

        super(`${functionReference.requestHandlerType?.name}Function`);

        if (functionReference.requestHandlerType === undefined) throw new Error('functionReference.requestHandlerType === undefined');

        this.services = {
            responsePublisher: new NullExchangeMessagePublisher,
            functionInstanceRepository: new NullFunctionInstanceRepository
        };

        this.requestHandlerType = functionReference.requestHandlerType;
        
        if (initialise !== undefined) {
            initialise(this);            
        }
    }
    
    async handle(event: SNSEvent | ExchangeRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<ExchangeResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        throwErrorIfInvalid(this.services, () => RequestHandlerLambda.name);

        let message: ExchangeRequestMessage | ExchangeResponseMessage;
        let isDirectRequest: boolean;

        if ('Records' in event) {

            isDirectRequest = false;

            const snsMessage = event.Records[0].Sns;
            message = JSON.parse(snsMessage.Message);
        
            // TODO 02May20: Remove this temporary code
            if (snsMessage.Message.includes('6666') && (this.requestHandlerType.name === 'SumNumbersHandler')) {
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
                response = await flowContext.handleRequest(this.requestHandlerType, message.request);
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
                response = await flowContext.handleResponse(this.requestHandlerType, message.response);
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
 
