import { SNSEvent } from 'aws-lambda';
import SNS, { PublishInput } from 'aws-sdk/clients/sns';

import { FlowContext, AsyncResponse, RequestRouter, HandlerFactory, IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { AsyncCallingContext, AsyncRequestMessage, AsyncResponseMessage } from './AsyncExchange';

// TODO 25Apr20: Find out the lifetime of the following sort of constants. I.e. are they statics?
const sns = new SNS();

export class LambdaActivityRequestHandler {

    private readonly _HandlerType: new () => IActivityRequestHandlerBase;
    private readonly _requestRouter: RequestRouter;
    private readonly _handlerFactory: HandlerFactory;
    private readonly _flowExchangeTopic: string | undefined;
    private readonly _functionInstanceRepository: IFunctionInstanceRepository;

    constructor(HandlerType: new () => IActivityRequestHandlerBase, requestRouter: RequestRouter, handlerFactory: HandlerFactory, 
        flowExchangeTopic: string | undefined, functionInstanceRepository: IFunctionInstanceRepository) {

        this._HandlerType = HandlerType;
        this._requestRouter = requestRouter;
        this._handlerFactory = handlerFactory;
        this._flowExchangeTopic = flowExchangeTopic;
        this._functionInstanceRepository = functionInstanceRepository;
    }

    async handle<TRes>(event: SNSEvent): Promise<void> {
    
        console.log(`event: ${JSON.stringify(event)}`);
    
        const snsMessage = event.Records[0].Sns;
        const message: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(snsMessage.Message);
    
        console.log(`message: ${JSON.stringify(message)}`);
    
        let response: TRes | AsyncResponse;
        let callingContext: AsyncCallingContext;
        let resumeCount: number;
    
        const handler = this._handlerFactory.newHandler(this._HandlerType);

        if ('request' in message) {
            
            callingContext = message.callingContext;
            resumeCount = 0;
    
            const flowContext = FlowContext.newCorrelatedContext(message.callingContext.flowCorrelationId);
            flowContext.requestRouter = this._requestRouter;
            flowContext.handlerFactory = this._handlerFactory;
    
            response = await handler.handle(flowContext, message.request);
    
        } else {
    
            const functionInstance = await this._functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);
    
            if (functionInstance === undefined) throw new Error('functionInstance was undefined');

            if (functionInstance.requestId !== message.callingContext.requestId) {
                // TODO 26Apr20: Do something more in this case where request is not as we expect
                console.log(`The requestId does not match what was expected. Expected: ${functionInstance.requestId}, Actual: ${message.callingContext.requestId}`);
                return;
            }
    
            callingContext = functionInstance.callingContext;
            
            resumeCount = functionInstance.resumeCount + 1;        
            if (resumeCount > 100) throw new Error(`resumeCount exceeded threshold: ${resumeCount}`);
    
            const flowInstance = functionInstance.flowInstance;
    
            const flowContext = FlowContext.newResumeContext(flowInstance, message.response);
            flowContext.requestRouter = this._requestRouter;
            flowContext.handlerFactory = this._handlerFactory;

            response = await handler.handle(flowContext);
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
    
            const responseMessage: AsyncResponseMessage = 
                {
                    callingContext: callingContext,
                    response: response
                };
    
            console.log(`responseMessage: ${JSON.stringify(responseMessage)}`);
    
            const params: PublishInput = {
                Message: JSON.stringify(responseMessage),
                TopicArn: this._flowExchangeTopic,
                MessageAttributes: {
                    MessageType: { DataType: 'String', StringValue: `${callingContext.flowTypeName}:Response` }
                }
            };
            
            const publishResponse = await sns.publish(params).promise();
        
            console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);
    
        }
    
        if (!('AsyncResponse' in response) && (resumeCount > 0)) {
            console.log(`DELETE flowInstanceId: ${message.callingContext.flowInstanceId}`);
            // TODO 25Apr20: Reinstate the delete
            // await this._functionInstanceRepository.delete(message.callingContext.flowInstanceId);
        }
    }
}
 
