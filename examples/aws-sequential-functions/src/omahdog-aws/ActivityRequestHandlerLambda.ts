import { SNSEvent } from 'aws-lambda';

import { FlowContext, RequestRouter, HandlerFactory, IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { ExchangeCallingContext, ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IExchangeMessagePublisher } from './IExchangeMessagePublisher';
import { LambdaBase, FunctionReference } from './SAMTemplate';
import { IResource } from './IResource';

class RequestHandlerLambdaResources {
    responsePublisher: IExchangeMessagePublisher;
    functionInstanceRepository: IFunctionInstanceRepository;
}

export class RequestHandlerLambda extends LambdaBase implements IResource {

    resources = new RequestHandlerLambdaResources

    readonly handlerType: new () => IActivityRequestHandlerBase;

    constructor(functionReference: FunctionReference, initialise?: (lambda: RequestHandlerLambda) => void) {

        super(`${functionReference.requestHandlerType?.name}Function`);

        if (functionReference.requestHandlerType === undefined) throw new Error('functionReference.requestHandlerType === undefined');

        this.handlerType = functionReference.requestHandlerType;
        
        if (initialise !== undefined) {
            initialise(this);            
        }
    }

    validate(): string[] {

        const errorMessages: string[] = [];

        if (this.resources.responsePublisher === undefined) {
            errorMessages.push(`${RequestHandlerLambda.name}: responsePublisher === undefined`);
        } else {
            errorMessages.concat(this.resources.responsePublisher.validate());
        }

        // TODO 01Jun20: Can we work out if functionInstanceRepository is required?
        if (this.resources.functionInstanceRepository === undefined) {
            errorMessages.push(`${RequestHandlerLambda.name}: functionInstanceRepository === undefined`);
        } else {
            errorMessages.concat(this.resources.functionInstanceRepository.validate());
        }

        return errorMessages;
    }
    
    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            throw new Error(`${RequestHandlerLambda.name} is not valid:\n${errorMessages.join('\n')}`);
        }
    }
    
    async handle(event: SNSEvent | ExchangeRequestMessage, requestRouter: RequestRouter, handlerFactory: HandlerFactory): Promise<ExchangeResponseMessage | void> {

        console.log(`event: ${JSON.stringify(event)}`);

        this.throwErrorIfInvalid();

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
    
            const functionInstance = await this.resources.functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);
    
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
    
            await this.resources.functionInstanceRepository.store(functionInstance);

        } else {

            if (!isDirectRequest) {
                await this.resources.responsePublisher.publishResponse(callingContext.handlerTypeName, responseMessage);
            }

            if (resumeCount > 0) {
                // TODO 18May20: Perhaps we want to leave a trace, could have a TTL on the table
                console.log(`DELETE flowInstanceId: ${message.callingContext.flowInstanceId}`);
                await this.resources.functionInstanceRepository.delete(message.callingContext.flowInstanceId);
            }
    
        }

        if (isDirectRequest) {
            console.log(`return: ${JSON.stringify(responseMessage)}`);
            return responseMessage;
        } 
    }
}
 
