import AWS from 'aws-sdk';
import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage, AsyncCallingContext } from './SNSActivityRequestHandler';
import { AsyncResponse, FlowHandlers } from '../omahdog/FlowHandlers';
import { FlowContext, FlowInstance } from '../omahdog/FlowContext';
import { PublishInput } from 'aws-sdk/clients/sns';

export async function flowHandler<TRes>(
    event: SNSEvent, handler: any, subHandlers: FlowHandlers, flowExchangeTopic: string | undefined, 
    functionInstanceRepository: IFunctionInstanceRepository, sns: AWS.SNS): Promise<void> {

    // TODO 23Apr20: Store and retrieve the function instance using the instanceId

    console.log(`event: ${JSON.stringify(event)}`);

    const snsMessage = event.Records[0].Sns;
    const message: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(snsMessage.Message);

    console.log(`message: ${JSON.stringify(message)}`);

    let response: TRes | AsyncResponse;
    let callingContext: AsyncCallingContext;
    let resumeCount: number;

    if ('request' in message) {
        
        callingContext = message.callingContext;
        resumeCount = 0;

        const flowContext = FlowContext.newCorrelatedContext(message.callingContext.flowCorrelationId);
        flowContext.handlers = subHandlers;

        response = await handler.handle(flowContext, message.request);

    } else {

        const functionInstance = await functionInstanceRepository.retrieve(message.callingContext.flowInstanceId);

        if (functionInstance === undefined) throw new Error('functionInstance was undefined');

        callingContext = functionInstance.callingContext;
        resumeCount = functionInstance.resumeCount + 1;
        
        if (resumeCount > 100) throw new Error(`resumeCount exceeded threshold: ${resumeCount}`);

        const flowInstance = functionInstance.flowInstance;

        const flowContext = 
            FlowContext.newResumeContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, message.response);
        flowContext.handlers = subHandlers;

        response = await handler.handle(flowContext);
    }

    if ('AsyncResponse' in response) {

        const functionInstance: FunctionInstance = {
            callingContext: callingContext,
            flowInstance: response.getFlowInstance(),
            resumeCount: resumeCount
        };

        console.log(`functionInstance: ${JSON.stringify(functionInstance)}`);

        await functionInstanceRepository.store(response.instanceId, functionInstance);

    } else {

        const responseMessage: AsyncResponseMessage = 
            {
                callingContext: callingContext,
                response: response
            };

        console.log(`responseMessage: ${JSON.stringify(responseMessage)}`);

        const params: PublishInput = {
            Message: JSON.stringify(responseMessage),
            TopicArn: flowExchangeTopic,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: `${callingContext.flowTypeName}:Response` }
            }
        };
        
        const publishResponse = await sns.publish(params).promise();
    
        console.log(`publishResponse.MessageId: ${publishResponse.MessageId}`);

    }

    if (('response' in message) && (resumeCount > 0)) {
        await functionInstanceRepository.delete(message.callingContext.flowInstanceId);
    }
}

export class FunctionInstance {
    readonly callingContext: AsyncCallingContext;
    readonly flowInstance: FlowInstance;
    readonly resumeCount: number;
}

export interface IFunctionInstanceRepository {

    store(requestId: string, instance: FunctionInstance): Promise<void>;
    
    retrieve(requestId: string): Promise<FunctionInstance | undefined>;
    
    delete(requestId: string): Promise<void>;
}   

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    private readonly _tableName?: string;

    constructor(tableName?: string) {
        this._tableName = tableName;        
    }

    async store(requestId: string, instance: FunctionInstance): Promise<void> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this._tableName,
            Item: {
                id: requestId,
                callingContext: instance.callingContext,
                flowInstanceJson: JSON.stringify(instance.flowInstance),
                resumeCount: instance.resumeCount,
                lastUpdated: new Date().toISOString()    
            }
        };

        await dynamoDb.put(params).promise();
    }
    
    async retrieve(requestId: string): Promise<FunctionInstance | undefined> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: requestId
            }
        };

        const dynamoDbResult: any = await dynamoDb.get(params).promise();

        if (dynamoDbResult === undefined) {
            return undefined;
        }

        const functionInstanceItem = dynamoDbResult.Item;

        console.log(`functionInstanceItem: ${JSON.stringify(functionInstanceItem)}`);

        const functionInstance: FunctionInstance = {
            callingContext: functionInstanceItem.callingContext,
            flowInstance: JSON.parse(functionInstanceItem.flowInstanceJson),
            resumeCount: functionInstanceItem.resumeCount
        };

        return functionInstance;
    }
    
    async delete(requestId: string): Promise<void> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: requestId
            }
        };

        await dynamoDb.delete(params).promise();
    }
}   
