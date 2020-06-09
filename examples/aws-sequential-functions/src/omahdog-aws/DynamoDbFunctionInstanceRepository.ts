import { FunctionInstanceRepository, FunctionInstance } from './FunctionInstanceRepository';
import { DynamoDBCrudService } from './AwsServices';

export class DynamoDbFunctionInstanceRepository implements FunctionInstanceRepository {
    
    services = {
        functionInstanceTable: new DynamoDBCrudService
    }

    constructor(initialise?: (resource: DynamoDbFunctionInstanceRepository) => void) {
        if (initialise !== undefined) initialise(this);
    }

    validate(): string[] {
        let errorMessages: string[] = [];
        errorMessages = errorMessages.concat(this.services.functionInstanceTable.validate().map(m => `services.functionInstanceTable: ${m}`));
        return errorMessages;
    }
    
    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            throw new Error(`${DynamoDbFunctionInstanceRepository.name} is not valid:\n${errorMessages.join('\n')}`);
        }
    }

    async store(instance: FunctionInstance): Promise<void> {
        
        this.throwErrorIfInvalid();

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

        await this.services.functionInstanceTable?.client?.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        this.throwErrorIfInvalid();

        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: instanceId
            }
        };

        const dynamoDbResult: any = await this.services.functionInstanceTable?.client?.get(params).promise();

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
        
        this.throwErrorIfInvalid();

        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: instanceId
            }
        };

        await this.services.functionInstanceTable?.client?.delete(params).promise();
    }

    private getFunctionInstanceTableName(): string {
        return this.services.functionInstanceTable?.tableName ?? '<unknown>';
    }
}   

