import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { SNS, Lambda } from 'aws-sdk';
import { ConfigurationValue, TemplateReference } from './SAMTemplate';

export abstract class AwsService {

    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    
    constructor(type: new () => AwsService, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }

    abstract getPolicy(): any;
}

export class DynamoDbTableCrudService extends AwsService {
    
    private readonly tableNameValue?: ConfigurationValue;
    readonly documentClient?: DocumentClient;

    constructor(tableReference?: TemplateReference, tableNameValue?: ConfigurationValue, documentClient?: DocumentClient) {
        super(DynamoDbTableCrudService, tableReference);
        this.tableNameValue = tableNameValue;
        this.documentClient = documentClient;
    }

    get tableName(): string | undefined {
        return this.tableNameValue?.value;
    }

    getPolicy(): any {
        return {
            'DynamoDBCrudPolicy': { 'TableName' : this.templateReference?.instance }
        };
    }
}

export class SNSTopicPublishService extends AwsService {
    
    private readonly topicArnValue?: ConfigurationValue;
    readonly sns?: SNS;

    constructor(topicReference?: TemplateReference, topicArnValue?: ConfigurationValue, sns?: SNS) {
        super(SNSTopicPublishService, topicReference);
        this.topicArnValue = topicArnValue;
        this.sns = sns;
    }

    get topicArn(): string | undefined {
        return this.topicArnValue?.value;
    }

    getPolicy(): any {
        return {
            'SNSPublishMessagePolicy': { 'TopicName' : this.templateReference?.instance }
        };
    }
}

export class LambdaInvokeService extends AwsService {

    private readonly functionNameValue?: ConfigurationValue;
    readonly fn?: Lambda;

    constructor(functionReference?: TemplateReference, functionNameValue?: ConfigurationValue, fn?: Lambda) {
        super(DynamoDbTableCrudService, functionReference);
        this.functionNameValue = functionNameValue;
        this.fn = fn;
    }
    
    get functionName(): string | undefined {
        return this.functionNameValue?.value;
    }

    getPolicy(): any {
        return {
            'LambdaInvokePolicy': { 'FunctionName' : this.templateReference?.instance }
        };
    }
}
