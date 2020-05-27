import DynamoDB from 'aws-sdk/clients/dynamodb';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    // TODO 27May20: Should we allow resources to have resources? E.g. A resource wrapper such as this?

    private readonly documentClient: DynamoDB.DocumentClient;
    private readonly tableName?: string;

    constructor(documentClient: DynamoDB.DocumentClient, tableName?: string) {
        this.documentClient = documentClient;
        this.tableName = tableName;        
    }

    async store(instance: FunctionInstance): Promise<void> {
        
        if (this.tableName === undefined) throw new Error('this.tableName is undefined');

        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this.tableName,
            Item: {
                id: instance.flowInstance.instanceId,
                callingContext: instance.callingContext,
                flowInstanceJson: JSON.stringify(instance.flowInstance),
                requestId: instance.requestId,
                resumeCount: instance.resumeCount,
                lastUpdated: new Date().toISOString()    
            }
        };

        await this.documentClient.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        if (this.tableName === undefined) throw new Error('this.tableName is undefined');

        const params = {
            TableName: this.tableName,
            Key: {
                id: instanceId
            }
        };

        const dynamoDbResult: any = await this.documentClient.get(params).promise();

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
        
        if (this.tableName === undefined) throw new Error('this.tableName is undefined');

        const params = {
            TableName: this.tableName,
            Key: {
                id: instanceId
            }
        };

        await this.documentClient.delete(params).promise();
    }
}   

