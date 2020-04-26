import DynamoDB from 'aws-sdk/clients/dynamodb';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';

const dynamoDbClient = new DynamoDB.DocumentClient();

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

        await dynamoDbClient.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: instanceId
            }
        };

        const dynamoDbResult: any = await dynamoDbClient.get(params).promise();

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

        await dynamoDbClient.delete(params).promise();
    }
}   

