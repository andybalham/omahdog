class DocumentClient {
    put(params: any): void {}
}

class SNS {
    publish(params: any): void {
    }
}

abstract class ConfigurationValue {

    readonly configurationValueType: string;
    
    constructor(type: new () => ConfigurationValue) {
        this.configurationValueType = type.name;
    }

    abstract getValue(): string | undefined;

    get value(): string | undefined {
        return this.getValue();
    }
}

class EnvironmentVariableValue extends ConfigurationValue {
    
    readonly variableName?: string;
    readonly resourceReference?: ResourceReference;

    constructor(variableName?: string, resourceReference?: ResourceReference) {
        
        super(EnvironmentVariableValue);
        
        this.variableName = variableName;
        this.resourceReference= resourceReference;
    }

    getValue(): string | undefined {
        if (this.variableName === undefined) throw new Error('this.environmentVariableName === undefined');
        return process.env[this.variableName];
    }
}

class ConstantValue extends ConfigurationValue {
    
    readonly constantValue?: string;

    constructor(constantValue?: string) {
        super(ConstantValue);
        this.constantValue = constantValue;
    }

    getValue(): string | undefined {
        return this.constantValue;
    }
}

abstract class ResourceReference {
    // constructor(type: new () => ResourceReference){}
}

class NameResourceReference extends ResourceReference {
    readonly resourceName: string;
    constructor(resourceName: string) {
        super();
        this.resourceName = resourceName;
    }
}
class AttributeResourceReference extends ResourceReference {
    readonly resourceName: string;
    readonly attributeName: string;
    constructor(resourceName: string, attributeName: string) {
        super();
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }
}

abstract class AwsResource {
    readonly typeName: string;
    resourceReference?: ResourceReference;
    constructor(type: new () => AwsResource) {
        this.typeName = type.name;
    }
}

class DynamoDbTableCrudResource extends AwsResource {
    
    tableName?: ConfigurationValue;
    documentClient?: DocumentClient;

    constructor(tableArn?: ResourceReference, tableName?: ConfigurationValue, documentClient?: DocumentClient) {
        super(DynamoDbTableCrudResource);
        this.resourceReference = tableArn;
        this.tableName = tableName;
        this.documentClient = documentClient;
    }
}

class SNSTopicPublishResource extends AwsResource {
    
    topicArn?: ConfigurationValue;
    sns?: SNS;

    constructor(topicName?: ResourceReference, topicArn?: ConfigurationValue, sns?: SNS) {
        super(SNSTopicPublishResource);
        this.resourceReference = topicName;
        this.topicArn = topicArn;
        this.sns = sns;
    }
}

class HandlerBuilder {
    handlerType: new () => Handler;
    initialise: (handler: Handler) => void;
}

class HandlerFactory {

    private readonly builderMap = new Map<string, HandlerBuilder>();

    register<T extends Handler>(type: new () => T, initialise: (handler: T) => void): HandlerFactory {
        this.builderMap.set(type.name, { handlerType: type, initialise: (initialise as (handler: Handler) => void)});
        return this;
    }

    build<T extends Handler>(type: new () => T): T {
        const builder = this.builderMap.get(type.name);
        if (builder === undefined) throw new Error('builder === undefined');
        const handler = new builder.handlerType() as T;
        builder.initialise(handler);
        return handler;
    }
}

abstract class Handler {
    abstract handle(): void;
}

class TableHandler extends Handler {

    resources = {
        flowResultTable: new DynamoDbTableCrudResource,
        exchangeTopic: new SNSTopicPublishResource,
    }

    handle(): void {

        if (this.resources.flowResultTable.documentClient === undefined) throw new Error('this.resources.dynamoDbTable.documentClient === undefined');
        if (this.resources.flowResultTable.tableName === undefined) throw new Error('this.resources.dynamoDbTable.tableName === undefined');

        const tableParams: any = {
            TableName: this.resources.flowResultTable.tableName.value,
            Item: {
                id: 'id',
                result: 'result'
            }
        };

        this.resources.flowResultTable.documentClient.put(tableParams);

        if (this.resources.exchangeTopic.sns === undefined) throw new Error('this.resources.exchangeTopic.sns === undefined');
        if (this.resources.exchangeTopic.topicArn === undefined) throw new Error('this.resources.exchangeTopic.topicArn === undefined');

        const params = {
            Message: JSON.stringify('message'),
            TopicArn: this.resources.exchangeTopic.topicArn.value,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: 'Response' }
            }
        };

        this.resources.exchangeTopic.sns.publish(params);
        
    }
}

describe('Ad-hoc tests', () => {

    it.only('test handler reflection', () => {
        
        process.env.FLOW_RESULT_TABLE_NAME = 'MyTable';
        process.env.FLOW_EXCHANGE_TOPIC_ARN = 'MyTopic';
        
        const documentClient = new DocumentClient;
        const sns = new SNS;

        const resourceNames = {
            flowResultTable: 'FlowResultTable',
            exchangeTopic: 'FlowExchangeTopic',
        };

        const resourceReferences = {
            flowResultTable: new NameResourceReference(resourceNames.flowResultTable),
            exchangeTopic: new NameResourceReference(resourceNames.exchangeTopic),
            exchangeTopicName: new AttributeResourceReference(resourceNames.exchangeTopic, 'TopicName'),
        };

        const environmentVariables = {
            flowResultTableName: new EnvironmentVariableValue('FLOW_RESULT_TABLE_NAME', resourceReferences.flowResultTable),
            exchangeTopicArn: new EnvironmentVariableValue('FLOW_EXCHANGE_TOPIC_ARN', resourceReferences.exchangeTopic),
        };

        const resources = {
            flowResultTable: 
                new DynamoDbTableCrudResource(
                    resourceReferences.flowResultTable, environmentVariables.flowResultTableName, documentClient),
            exchangeTopic:
                new SNSTopicPublishResource(
                    resourceReferences.exchangeTopicName, environmentVariables.exchangeTopicArn, sns),
        };

        // Register the handlers

        const handlerFactory = new HandlerFactory()
            .register(TableHandler, handler => { 
                handler.resources.flowResultTable = resources.flowResultTable;
                handler.resources.exchangeTopic = resources.exchangeTopic;
            });

        const handler = handlerFactory.build(TableHandler);
        
        if ('resources' in handler) {
            console.log(JSON.stringify(handler.resources));
        }

        handler.handle();
    });
});