import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNS, Lambda } from 'aws-sdk';
import { ConfigurationValue, TemplateReference, EnvironmentVariable, ResourceAttributeReference, ResourceReference } from './SAMTemplate';
import { IResource } from './IResource';

export abstract class AwsResource implements IResource {

    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    
    constructor(type: new () => AwsResource, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }

    abstract validate(): string[];

    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            // TODO 30May20: Look at a more informative error
            throw new Error(`${this.typeName} is not valid`);
        }
    }

    abstract getPolicy(): any;
}

export class DynamoDBCrudResource extends AwsResource {
    
    private readonly tableNameValue?: ConfigurationValue;
    readonly client?: DocumentClient;

    constructor(tableReference?: TemplateReference, client?: DocumentClient, tableNameValue?: ConfigurationValue) {
        
        super(DynamoDBCrudResource, tableReference);
        
        this.client = client;

        if (tableReference === undefined) {
            this.tableNameValue = tableNameValue;    
        } else {
            this.tableNameValue = tableNameValue ?? new EnvironmentVariable(tableReference);            
        }
    }

    get tableName(): string | undefined {
        return this.tableNameValue?.value;
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.tableNameValue === undefined) errorMessages.push('this.tableNameValue === undefined');
        if (this.client === undefined) errorMessages.push('this.client === undefined');
        return errorMessages;
    }

    getPolicy(): any {
        return {
            'DynamoDBCrudPolicy': { 'TableName' : this.templateReference?.instance }
        };
    }
}

export class SNSPublishMessageResource extends AwsResource {
    
    private readonly topicArnValue?: ConfigurationValue;
    readonly client?: SNS;

    constructor(topicNameReference?: TemplateReference, client?: SNS, topicArnValue?: ConfigurationValue) {
        
        super(SNSPublishMessageResource, topicNameReference);
        
        this.client = client;

        if ((topicNameReference === undefined)
            || (topicNameReference.typeName !== 'ResourceAttributeReference')) {
            this.topicArnValue = topicArnValue;
        } else {
            this.topicArnValue = 
                topicArnValue ?? 
                    new EnvironmentVariable(new ResourceReference((topicNameReference as ResourceAttributeReference).resourceName));
        }
    }

    get topicArn(): string | undefined {
        return this.topicArnValue?.value;
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.topicArnValue === undefined) errorMessages.push('this.topicArnValue === undefined');
        if (this.client === undefined) errorMessages.push('this.client === undefined');
        return errorMessages;
    }

    getPolicy(): any {
        return {
            'SNSPublishMessagePolicy': { 'TopicName' : this.templateReference?.instance }
        };
    }
}

export class LambdaInvokeResource extends AwsResource {

    private readonly functionNameValue?: ConfigurationValue;
    readonly client?: Lambda;

    constructor(functionReference?: TemplateReference, client?: Lambda, functionNameValue?: ConfigurationValue) {
        
        super(DynamoDBCrudResource, functionReference);

        this.client = client;

        if (functionReference === undefined) {
            this.functionNameValue = functionNameValue;
        } else {
            this.functionNameValue = functionNameValue ?? new EnvironmentVariable(functionReference);
        }
    }
    
    get functionName(): string | undefined {
        return this.functionNameValue?.value;
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.functionNameValue === undefined) errorMessages.push('this.functionNameValue === undefined');
        if (this.client === undefined) errorMessages.push('this.client === undefined');
        return errorMessages;
    }

    getPolicy(): any {
        return {
            'LambdaInvokePolicy': { 'FunctionName' : this.templateReference?.instance }
        };
    }
}
