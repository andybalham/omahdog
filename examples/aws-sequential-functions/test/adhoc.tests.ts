class DocumentClient {
    put(params: any): void {}
}
class SNS {
    publish(params: any): void {
    }
}

class EnvironmentVariable {
    
    readonly variableName: string;
    readonly templateReference: TemplateReference;

    constructor(variableName: string, resourceReference: TemplateReference) {        
        this.variableName = variableName;
        this.templateReference = resourceReference;
    }

    get value(): string | undefined {
        return process.env[this.variableName];
    }
}
class MockEnvironmentVariable implements EnvironmentVariable {
    readonly variableName: string;
    readonly templateReference: TemplateReference;
    private readonly mockValue?: string;
    
    constructor(mockValue?: string) {
        this.mockValue = mockValue;
    }

    get value(): string | undefined {
        return this.mockValue;
    }
}

abstract class TemplateReference {
    readonly typeName: string;
    constructor(type: new () => TemplateReference) {
        this.typeName = type.name;
    }
}
class ResourceReference extends TemplateReference {
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }
}
class ParameterReference extends TemplateReference {
    readonly parameterName?: string;
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
}
class ResourceAttributeReference extends TemplateReference {
    readonly resourceName?: string;
    readonly attributeName?: string;
    constructor(resourceName?: string, attributeName?: string) {
        super(ResourceAttributeReference);
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }
}

abstract class AwsResource {
    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    constructor(type: new () => AwsResource, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }
}
class DynamoDbTableCrudResource extends AwsResource {
    
    tableName?: EnvironmentVariable;
    documentClient?: DocumentClient;

    constructor(tableName?: EnvironmentVariable, documentClient?: DocumentClient) {
        super(DynamoDbTableCrudResource, tableName?.templateReference);
        this.tableName = tableName;
        this.documentClient = documentClient;
    }
}
class SNSTopicPublishResource extends AwsResource {
    
    topicArn?: EnvironmentVariable;
    sns?: SNS;

    constructor(topicName?: TemplateReference, topicArn?: EnvironmentVariable, sns?: SNS) {
        super(SNSTopicPublishResource, topicName);
        this.topicArn = topicArn;
        this.sns = sns;
    }
}

interface IHandler {
    handle(): void;
}
interface IHandlerInitialiser {
    (handler: IHandler): void;
}
class HandlerFactory {

    private readonly initialisers = new Map<string, IHandlerInitialiser>();

    addInitialiser<T extends IHandler>(type: new () => T, initialiser: (handler: T) => void): HandlerFactory {
        this.initialisers.set(type.name, initialiser);
        return this;
    }

    build<T extends IHandler>(type: new () => T): T {
        const initialiser = this.initialisers.get(type.name);
        if (initialiser === undefined) throw new Error('initialiser === undefined');
        const handler = new type();
        initialiser(handler);
        return handler;
    }
}

class ExampleHandler implements IHandler {

    // TODO 23May20: How can a composite handler return a union of all resources in use?
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

class ActivityTrigger {}

class ActivityFunction {
    resourceName: string;
    // TODO 23May20: FunctionName, DeadLetterQueue
    triggers: Map<string, ActivityTrigger>;
    resources: Map<string, AwsResource>;
}

class ActivityFunctions {

    // TODO 23May20: We need to return the triggers and resources for each function

    triggers = {
        // TODO 23May20: Define SNS event, specifying topic, but with filter by convention
    }

    // TODO 23May20: How can this be combined with the resources required by the handlers?
    // TODO 23May20: The following resources are common to all functions
    resources = {
        flowInstanceTable: new DynamoDbTableCrudResource,
        exchangeTopic: new SNSTopicPublishResource,
    }

    constructor(deadLetterQueueReference?: TemplateReference) {
        // TODO 23May20: Assuming the same DLQ for all functions, if a DLQ reference supplied
        // TODO 23May20: Set requestRouter, handlerFactory here
    }

    register(handlerType: new () => IHandler, nameTemplate: string): any {
        // TODO 23May20: Register the handlers to be made into functions, for purposes of inspection 
    }

    getFunctions(): ActivityFunction[] {
        // TODO 23May20: Should we always return a DLQ function?
        return [];
    }

    handleRequest(handlerType: new () => IHandler, event: any): any {        
    }

    handleDeadLetterQueueMessage(event: any): any {
    }
}



describe('Handler tests', () => {

    it('can be unit tested', () => {
        
        const tableHandler = new ExampleHandler;
        
        tableHandler.resources.flowResultTable.tableName = new MockEnvironmentVariable('MyTable');
        tableHandler.resources.flowResultTable.documentClient = new DocumentClient;

        tableHandler.resources.exchangeTopic.topicArn = new MockEnvironmentVariable('MyTopicArn');
        tableHandler.resources.exchangeTopic.sns = new SNS;
        
        tableHandler.handle();
    });
    

    it('can be reflected upon and exercised', () => {
        
        const documentClient = new DocumentClient;
        const sns = new SNS;

        const resourceNames = {
            flowResultTable: 'FlowResultTable',
            exchangeTopic: 'FlowExchangeTopic',
        };

        const templateReferences = {
            flowResultTable: new ResourceReference(resourceNames.flowResultTable),
            exchangeTopicArn: new ResourceReference(resourceNames.exchangeTopic),
            exchangeTopicName: new ResourceAttributeReference(resourceNames.exchangeTopic, 'TopicName'),
        };

        const environmentVariables = {
            flowResultTableName: 
                new EnvironmentVariable('FLOW_RESULT_TABLE_NAME', templateReferences.flowResultTable),
            exchangeTopicArn: 
                new EnvironmentVariable('FLOW_EXCHANGE_TOPIC_ARN', templateReferences.exchangeTopicArn),
        };

        const awsResources = {
            flowResultTable: 
                new DynamoDbTableCrudResource(
                    environmentVariables.flowResultTableName, documentClient),
            exchangeTopic:
                new SNSTopicPublishResource(
                    templateReferences.exchangeTopicName, environmentVariables.exchangeTopicArn, sns),
        };

        const handlerFactory = new HandlerFactory()
            .addInitialiser(ExampleHandler, handler => { 
                handler.resources.flowResultTable = awsResources.flowResultTable;
                handler.resources.exchangeTopic = awsResources.exchangeTopic;
            });

        // Get a handler and inspect the resources

        const handler = handlerFactory.build(ExampleHandler);
        
        if ('resources' in handler) {
            console.log(JSON.stringify(handler.resources));
        }

        // Exercise the handler
        
        process.env.FLOW_RESULT_TABLE_NAME = 'MyTable';
        process.env.FLOW_EXCHANGE_TOPIC_ARN = 'MyTopicArn';
        
        handler.handle();
    });
});