import { FunctionInstance, IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { DynamoDBCrudService } from './AwsServices';

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    isNullImplementation: boolean;

    services = {
        functionInstanceTable: new DynamoDBCrudService
    }

    constructor(initialise?: (resource: DynamoDbFunctionInstanceRepository) => void) {
        if (initialise !== undefined) initialise(this);
    }
    
    async store(instance: FunctionInstance): Promise<void> {
        
        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this.getFunctionInstanceTableName(),
            Item: {
                id: instance.flowInstance.instanceId,
                callingContext: instance.callingContext,
                flowInstanceJson: JSON.stringify(instance.flowInstance),
                requestId: instance.requestId,
                resumeCount: instance.resumeCount,
                lastUpdated: new Date().toISOString()    
            }
        };

        if (this.services.functionInstanceTable.client === undefined) throw new Error('this.services.functionInstanceTable.client === undefined');

        await this.services.functionInstanceTable.client.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: instanceId
            }
        };

        if (this.services.functionInstanceTable.client === undefined) throw new Error('this.services.functionInstanceTable.client === undefined');
        
        const dynamoDbResult: any = await this.services.functionInstanceTable.client.get(params).promise();

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
        
        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: instanceId
            }
        };

        if (this.services.functionInstanceTable.client === undefined) throw new Error('this.services.functionInstanceTable.client === undefined');
        
        await this.services.functionInstanceTable.client.delete(params).promise();
    }

    private getFunctionInstanceTableName(): string {
        return this.services.functionInstanceTable.tableName ?? '<unknown>';
    }
}   

