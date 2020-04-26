import AWS from 'aws-sdk';
import { FlowInstance } from '../omahdog/FlowContext';

export class FunctionInstance {
    readonly callingContext: AsyncCallingContext;
    readonly flowInstance: FlowInstance;
    readonly requestId: string;
    readonly resumeCount: number;
}

export interface IFunctionInstanceRepository {

    store(instance: FunctionInstance): Promise<void>;
    
    retrieve(instanceId: string): Promise<FunctionInstance | undefined>;
    
    delete(instanceId: string): Promise<void>;
}   

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    private readonly _tableName?: string;

    constructor(tableName?: string) {
        this._tableName = tableName;        
    }

    async store(instance: FunctionInstance): Promise<void> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this._tableName,
            Item: {
                id: instance.flowInstance.instanceId,
                callingContext: instance.callingContext,
                flowInstanceJson: JSON.stringify(instance.flowInstance),
                requestId: instance.requestId,
                resumeCount: instance.resumeCount,
                lastUpdated: new Date().toISOString()    
            }
        };

        await dynamoDb.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: instanceId
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
            requestId: functionInstanceItem.requestId,
            resumeCount: functionInstanceItem.resumeCount
        };

        return functionInstance;
    }
    
    async delete(instanceId: string): Promise<void> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: instanceId
            }
        };

        await dynamoDb.delete(params).promise();
    }
}   

export class AsyncCallingContext {
    readonly requestId: string;
    readonly flowTypeName: string;
    readonly flowInstanceId: string;
    readonly flowCorrelationId: string;
}

export class AsyncRequestMessage {
    readonly callingContext: AsyncCallingContext;
    readonly request: any;
}

export class AsyncResponseMessage {
    readonly callingContext: AsyncCallingContext;
    readonly response: any;
}
