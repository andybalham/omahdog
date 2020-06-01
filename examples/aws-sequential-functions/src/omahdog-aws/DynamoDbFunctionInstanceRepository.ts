import DynamoDB from 'aws-sdk/clients/dynamodb';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { DynamoDBCrudResource } from './AwsResources';

export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository {
    
    resources = {
        functionInstanceTable: new DynamoDBCrudResource
    }

    constructor(initialise?: (resource: DynamoDbFunctionInstanceRepository) => void) {
        if (initialise !== undefined) initialise(this);
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        this.resources.functionInstanceTable.validate().forEach(message => 
            errorMessages.push(`${DynamoDbFunctionInstanceRepository.name}: ${message}`));
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

        await this.resources.functionInstanceTable?.client?.put(params).promise();
    }
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> {
        
        this.throwErrorIfInvalid();

        const params = {
            TableName: this.getFunctionInstanceTableName(),
            Key: {
                id: instanceId
            }
        };

        const dynamoDbResult: any = await this.resources.functionInstanceTable?.client?.get(params).promise();

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

        await this.resources.functionInstanceTable?.client?.delete(params).promise();
    }

    private getFunctionInstanceTableName(): string {
        return this.resources.functionInstanceTable?.tableName ?? '<unknown>';
    }
}   

