import DynamoDB from 'aws-sdk/clients/dynamodb';
import { IFunctionInstanceRepository, FunctionInstance } from './IFunctionInstanceRepository';
import { DynamoDBCrudResource, IResource } from './AwsResources';

// TODO 30May20: IFunctionInstanceRepository should implement IResource
export class DynamoDbFunctionInstanceRepository implements IFunctionInstanceRepository, IResource {
    
    // TODO 27May20: Should we allow resources to have resources? E.g. A resource wrapper such as this?
    resources: {
        functionInstanceTable?: DynamoDBCrudResource;
    }

    constructor(initialise: (resource: DynamoDbFunctionInstanceRepository) => void) {
        initialise(this);
    }

    validate(): string[] {

        const errorMessages: string[] = [];

        if (this.resources.functionInstanceTable === undefined) {
            errorMessages.push('this.resources.functionInstanceTable === undefined');
        } else {
            errorMessages.concat(this.resources.functionInstanceTable.validate());
        }

        return errorMessages;
    }
    
    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            // TODO 30May20: Look at a more informative error
            throw new Error('DynamoDbFunctionInstanceRepository is not valid');
        }
    }

    async store(instance: FunctionInstance): Promise<void> {
        
        this.throwErrorIfInvalid();

        // TODO 22Apr20: How can we make the following more strongly-typed?
        const params: any = {
            TableName: this.resources.functionInstanceTable?.tableName ?? '<unknown>',
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
            TableName: this.resources.functionInstanceTable?.tableName ?? '<unknown>',
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
            TableName: this.resources.functionInstanceTable?.tableName ?? '<unknown>',
            Key: {
                id: instanceId
            }
        };

        await this.resources.functionInstanceTable?.client?.delete(params).promise();
    }
}   

