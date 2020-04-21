import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage, AsyncExchangeContext } from './SNSActivityRequestHandler';
import { AsyncResponse, FlowHandlers } from '../omahdog/FlowHandlers';
import { FlowContext, FlowInstance } from '../omahdog/FlowContext';
import { PublishInput } from 'aws-sdk/clients/sns';

export async function flowHandler<TRes>(
    event: SNSEvent, handler: any, subHandlers: FlowHandlers, flowExchangeTopic: string | undefined, 
    functionInstanceRepository: IFunctionInstanceRepository, sns: AWS.SNS): Promise<void> {

    console.log(`event: ${JSON.stringify(event)}`);

    const snsMessage = event.Records[0].Sns;
    const message: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(snsMessage.Message);

    let response: TRes | AsyncResponse;
    let callingContext: AsyncExchangeContext;

    if ('request' in message) {
        
        callingContext = message.context;

        const flowContext = new FlowContext(message.context.flowInstanceId);
        flowContext.handlers = subHandlers;

        response = await handler.handle(flowContext, message.request);

    } else {

        // TODO 21Apr20: Check the resume count

        const functionInstance = functionInstanceRepository.retrieve(message.context.requestId);

        if (functionInstance === undefined) throw new Error('instance was undefined');

        callingContext = functionInstance.callingContext;

        const flowContext = new FlowContext(callingContext.flowInstanceId, functionInstance.flowInstance.stackFrames, message.response);
        flowContext.handlers = subHandlers;

        response = await new handler.handle(flowContext);
    }

    if ('AsyncResponse' in response) {

        functionInstanceRepository.store({
            callingContext: callingContext,
            flowInstance: response.getFlowInstance()
        });

    } else {

        const message: AsyncResponseMessage = 
            {
                context: {
                    requestId: callingContext.requestId,
                    flowInstanceId: callingContext.flowInstanceId,
                    flowTypeName: callingContext.flowTypeName
                },
                response: response
            };

        const params: PublishInput = {
            Message: JSON.stringify(message),
            TopicArn: flowExchangeTopic,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${callingContext.flowTypeName}:Response` }
            }
        };
        
        const publishResponse = await sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

    }

    if ('response' in message) {
        functionInstanceRepository.delete(message.context.requestId);
    }
}

export class FunctionInstance {
    readonly callingContext: AsyncExchangeContext;
    readonly flowInstance: FlowInstance;
}

export interface IFunctionInstanceRepository {

    store(instance: FunctionInstance): void;
    
    retrieve(requestId: string): FunctionInstance | undefined;
    
    delete(requestId: string): void;
}   

export class InMemoryInstanceRepository implements IFunctionInstanceRepository {

    private readonly _mapRepository = new Map<string, FunctionInstance>();

    store(instance: FunctionInstance): void {
        this._mapRepository.set(instance.callingContext.requestId, instance);
    }
    
    retrieve(requestId: string): FunctionInstance | undefined {
        return this._mapRepository.get(requestId);
    }
    
    delete(requestId: string): void {
        this._mapRepository.delete(requestId);
    }
}   
