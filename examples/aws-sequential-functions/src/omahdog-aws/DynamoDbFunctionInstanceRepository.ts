import DynamoDB from 'aws-sdk/clients/dynamodb';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    private readonly _documentClient: DynamoDB.DocumentClient;
    private readonly _tableName?: string;

    constructor(documentClient: DynamoDB.DocumentClient, tableName?: string) {
        this._documentClient = documentClient;
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

        await this._documentClient.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        if (this._tableName === undefined) throw new Error('this._tableName is undefined');

        const params = {
            TableName: this._tableName,
            Key: {
                id: instanceId
            }
        };

        const dynamoDbResult: any = await this._documentClient.get(params).promise();

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

        await this._documentClient.delete(params).promise();
    }
}   

