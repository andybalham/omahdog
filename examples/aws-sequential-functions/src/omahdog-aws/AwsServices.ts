import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNS, Lambda } from 'aws-sdk';
import { ConfigurationValue, TemplateReference, EnvironmentVariable, ResourceAttributeReference, ResourceReference } from './SAMTemplate';

export abstract class AwsService {

    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    
    constructor(type: new () => AwsService, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }

    abstract validate(): string[];
    abstract getPolicies(): any[];
}

export class DynamoDBCrudService extends AwsService {
    
    parameters = {
        tableName: new ConfigurationValue
    }

    readonly client?: DocumentClient;

    constructor(tableReference?: TemplateReference, client?: DocumentClient, tableNameValue?: ConfigurationValue) {
        
        super(DynamoDBCrudService, tableReference);
        
        this.client = client;

        if (tableReference === undefined) {
            this.parameters.tableName = tableNameValue ?? this.parameters.tableName;
        } else {
            this.parameters.tableName = tableNameValue ?? new EnvironmentVariable(tableReference);            
        }
    }

    get tableName(): string | undefined {
        return this.parameters.tableName.value;
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.client === undefined) errorMessages.push('this.client === undefined');
        return errorMessages;
    }

    getPolicies(): any[] {
        // TODO 13Jun20: We would also need to take into account any policies required to access the table name, e.g. SSM
        return [
            {
                'DynamoDBCrudPolicy': { 'TableName' : this.templateReference?.instance }
            }
        ];
    }
}

export class SNSPublishMessageService extends AwsService {
    
    private readonly topicArnValue?: ConfigurationValue;
    readonly client?: SNS;

    constructor(topicNameReference?: TemplateReference, client?: SNS, topicArnValue?: ConfigurationValue) {
        
        super(SNSPublishMessageService, topicNameReference);
        
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

    getPolicies(): any[] {
        return [
            {
                'SNSPublishMessagePolicy': { 'TopicName' : this.templateReference?.instance }
            }
        ];
    }
}

export class LambdaInvokeService extends AwsService {

    private readonly functionNameValue?: ConfigurationValue;
    readonly client?: Lambda;

    constructor(functionReference?: TemplateReference, client?: Lambda, functionNameValue?: ConfigurationValue) {
        
        super(DynamoDBCrudService, functionReference);

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

    getPolicies(): any[] {
        return [
            {
                'LambdaInvokePolicy': { 'FunctionName' : this.templateReference?.instance }
            }
        ];
    }
}
