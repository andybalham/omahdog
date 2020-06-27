import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNS, Lambda } from 'aws-sdk';
import { TemplateReference, ResourceReference, ResourceReferenceAttribute } from './TemplateReferences';
import { IConfigurationValue, EnvironmentVariable } from './ConfigurationValues';

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

class DynamoDBCrudServiceParameters {
    tableName?: IConfigurationValue
}

export class DynamoDBCrudService extends AwsService {
    
    parameters = new DynamoDBCrudServiceParameters

    readonly client?: DocumentClient;

    constructor(tableReference?: TemplateReference, client?: DocumentClient, tableNameValue?: IConfigurationValue) {
        
        super(DynamoDBCrudService, tableReference);
        
        this.client = client;

        if (tableReference === undefined) {
            this.parameters.tableName = tableNameValue ?? this.parameters.tableName;
        } else {
            this.parameters.tableName = tableNameValue ?? new EnvironmentVariable(tableReference);            
        }
    }

    get tableName(): string | undefined {
        return this.parameters.tableName?.evaluate();
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.parameters.tableName === undefined) errorMessages.push('this.parameters.tableName === undefined');
        if (this.client === undefined) errorMessages.push('this.client === undefined');
        return errorMessages;
    }

    getPolicies(): any[] {
        return [
            {
                'DynamoDBCrudPolicy': { 'TableName' : this.templateReference?.instance }
            }
        ];
    }
}

class SNSPublishMessageServiceParameters {
    topicArnValue?: IConfigurationValue
}

export class SNSPublishMessageService extends AwsService {
    
    parameters = new SNSPublishMessageServiceParameters
    
    readonly client?: SNS;

    constructor(topicNameReference?: TemplateReference, client?: SNS, topicArnValue?: IConfigurationValue) {
        
        super(SNSPublishMessageService, topicNameReference);
        
        this.client = client;

        if ((topicNameReference === undefined)
            || (topicNameReference.typeName !== ResourceReferenceAttribute.name)) {

            this.parameters.topicArnValue = topicArnValue;

        } else {

            const resourceReference = (topicNameReference as ResourceReferenceAttribute).resourceReference;

            if (resourceReference === undefined) {
                this.parameters.topicArnValue = topicArnValue;                
            } else {
                this.parameters.topicArnValue = topicArnValue ?? new EnvironmentVariable(resourceReference);
            }
        }
    }

    get topicArn(): string | undefined {
        return this.parameters.topicArnValue?.evaluate();
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.parameters.topicArnValue === undefined) errorMessages.push('this.parameters.topicArnValue === undefined');
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

class LambdaInvokeServiceParameters {
    functionNameValue?: IConfigurationValue
}

export class LambdaInvokeService extends AwsService {

    parameters = new LambdaInvokeServiceParameters;    
    readonly client?: Lambda;

    constructor(functionReference?: TemplateReference, client?: Lambda, functionNameValue?: IConfigurationValue) {
        
        super(DynamoDBCrudService, functionReference);

        this.client = client;

        if (functionReference === undefined) {
            this.parameters.functionNameValue = functionNameValue;
        } else {
            this.parameters.functionNameValue = 
                functionNameValue ?? new EnvironmentVariable(functionReference);
        }
    }
    
    get functionName(): string | undefined {
        return this.parameters.functionNameValue?.evaluate();
    }

    validate(): string[] {
        const errorMessages: string[] = [];
        if (this.parameters.functionNameValue === undefined) errorMessages.push('this.parameters.functionNameValue === undefined');
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
