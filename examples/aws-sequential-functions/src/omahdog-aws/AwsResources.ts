import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNS, Lambda } from 'aws-sdk';
import { ConfigurationValue, TemplateReference } from './SAMTemplate';

export abstract class AwsResource {

    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    
    constructor(type: new () => AwsResource, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }

    abstract getPolicy(): any;
}

export class DynamoDbTableCrudResource extends AwsResource {
    
    tableName?: ConfigurationValue;
    documentClient?: DocumentClient;

    constructor(tableReference?: TemplateReference, tableName?: ConfigurationValue, documentClient?: DocumentClient) {
        super(DynamoDbTableCrudResource, tableReference);
        this.tableName = tableName;
        this.documentClient = documentClient;
    }

    getPolicy(): any {
        return {
            'DynamoDBCrudPolicy': { 'TableName' : this.templateReference?.instance }
        };
    }
}

export class SNSTopicPublishResource extends AwsResource {
    
    topicArn?: ConfigurationValue;
    sns?: SNS;

    constructor(topicName?: TemplateReference, topicArn?: ConfigurationValue, sns?: SNS) {
        super(SNSTopicPublishResource, topicName);
        this.topicArn = topicArn;
        this.sns = sns;
    }

    getPolicy(): any {
        return {
            'SNSPublishMessagePolicy': { 'TopicName' : this.templateReference?.instance }
        };
    }
}

export class LambdaInvokeResource extends AwsResource {
    
    functionName?: ConfigurationValue;
    lambda?: Lambda;

    constructor(functionReference?: TemplateReference, functionName?: ConfigurationValue, lambda?: Lambda) {
        super(DynamoDbTableCrudResource, functionReference);
        this.functionName = functionName;
        this.lambda = lambda;
    }

    getPolicy(): any {
        return {
            'LambdaInvokePolicy': { 'FunctionName' : this.templateReference?.instance }
        };
    }
}
