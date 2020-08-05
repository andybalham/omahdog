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
    
    async store(requestId: string, instance: FunctionInstance): Promise<void> {
        
        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this.getFunctionInstanceTableName(),
            Item: {
                id: requestId,
                instance: JSON.stringify(instance),
                lastUpdated: new Date().toISOString()    
            }
        };

        if (this.services.functionInstanceTable.client === undefined) throw new Error('this.services.functionInstanceTable.client === undefined');

        await this.services.functionInstanceTable.client.put(params).promise();
    }
    
    async retrieve(requestId: string): Promise<FunctionInstance | undefined> {
        
        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: requestId
            }
        };

        if (this.services.functionInstanceTable.client === undefined) throw new Error('this.services.functionInstanceTable.client === undefined');
        
        // TODO 20Jul20: Can the following be done in one transaction?
        const dynamoDbResult: any = await this.services.functionInstanceTable.client.get(params).promise();

        if (dynamoDbResult === undefined) {
            return undefined;
        }

        const functionInstanceItem = dynamoDbResult.Item;

        console.log(`Retrieved function instance: ${JSON.stringify(functionInstanceItem)}`);
        
        const deleteResult = await this.services.functionInstanceTable.client.delete(params).promise();

        console.log(`Deleted function instance: ${JSON.stringify(deleteResult)}`);

        const functionInstance = JSON.parse(functionInstanceItem.instance);

        return functionInstance;
    }

    private getFunctionInstanceTableName(): string {
        return this.services.functionInstanceTable.tableName ?? '<unknown>';
    }
}   

