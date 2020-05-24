import deepEqual from 'deep-equal';

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
    abstract get instance(): any;
}
class ResourceReference extends TemplateReference {
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }
    get instance(): any { return { 'Ref': this.resourceName }; }
}
class ParameterReference extends TemplateReference {
    readonly parameterName?: string;
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
    get instance(): any { return { 'Ref': this.parameterName }; }
}
class ResourceAttributeReference extends TemplateReference {
    readonly resourceName?: string;
    readonly attributeName?: string;
    constructor(resourceName?: string, attributeName?: string) {
        super(ResourceAttributeReference);
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }
    get instance(): any { return { 'Fn:Attr': [ this.resourceName, this.attributeName] }; }
}
interface IResource {
    typeName: string;
    getPolicy(): any;
}
abstract class AwsResource implements IResource {

    readonly typeName: string;
    readonly templateReference?: TemplateReference;
    
    constructor(type: new () => AwsResource, templateReference?: TemplateReference) {
        this.typeName = type.name;
        this.templateReference = templateReference;
    }

    abstract getPolicy(): any;
}
class DynamoDbTableCrudResource extends AwsResource {
    
    tableName?: EnvironmentVariable;
    documentClient?: DocumentClient;

    constructor(tableName?: EnvironmentVariable, documentClient?: DocumentClient) {
        super(DynamoDbTableCrudResource, tableName?.templateReference);
        this.tableName = tableName;
        this.documentClient = documentClient;
    }

    getPolicy(): any {
        return {
            DynamoDBCrudPolicy: { 'TableName' : this.templateReference?.instance }
        };
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

    getPolicy(): any {
        return {
            SNSPublishMessagePolicy: { 'TopicName' : this.templateReference?.instance }
        };
    }
}

interface IHandlerType {
    new (): IHandler;
}
interface IHandler {
    handle(): void;
    getHandlerTypes(requestRouter: RequestRouter): IHandlerType[];
}

class HandlerFactory {

    private readonly initialisers = new Map<string, (handler: any) => void>();

    addInitialiser<T extends IHandler>(type: new () => T, initialiser: (handler: T) => void): HandlerFactory {
        this.initialisers.set(type.name, initialiser);
        return this;
    }

    build<T extends IHandler>(type: new () => T): T {
        
        const handler = new type();

        const initialiser = this.initialisers.get(type.name);
        
        if (initialiser !== undefined) {
            initialiser(handler);
        }
        
        return handler;
    }
}

class RequestRouter {}

class ExampleHandler implements IHandler {

    resources = {
        flowResultTable: new DynamoDbTableCrudResource,
        exchangeTopic: new SNSTopicPublishResource,
    }

    getHandlerTypes(requestRouter: RequestRouter): IHandlerType[] { 
        return [ ExampleHandler ]; 
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

interface ITrigger {
    getEvent(): any;
}
abstract class AwsTrigger implements ITrigger {    
    abstract getEvent(): any;
}
class SNSTrigger extends AwsTrigger {
    // TODO 24May20: Can make the 
    constructor(filterPolicy?: any) {
        super();
    }
    getEvent(): any {
        return { };
    }
}

class ExampleProxyHandler implements IHandler {

    resources = {
        proxyTopic: new SNSTopicPublishResource
    }

    // TODO 24May20: Sometimes a function would want to send, but not receive. Perhaps there needs to be two separate handlers?

    triggers = {
        proxyResponse: new SNSTrigger({
            MessageType: [ `${this.typeName}.Response` ]
        })
    }

    get typeName(): string {
        // TODO 24May20: This would be sub-classed, to return the correct type
        return ExampleProxyHandler.name;
    }

    getHandlerTypes(requestRouter: RequestRouter): IHandlerType[] { 
        return [ ExampleProxyHandler ]; 
    }

    handle(): void {

        if (this.resources.proxyTopic.sns === undefined) throw new Error('this.resources.exchangeTopic.sns === undefined');
        if (this.resources.proxyTopic.topicArn === undefined) throw new Error('this.resources.exchangeTopic.topicArn === undefined');

        const params = {
            Message: JSON.stringify('message'),
            TopicArn: this.resources.proxyTopic.topicArn.value,
            MessageAttributes: {
                MessageType: { DataType: 'String', StringValue: 'Response' }
            }
        };

        this.resources.proxyTopic.sns.publish(params);        
    }
}

class CompositeHandler implements IHandler {

    getHandlerTypes(requestRouter: RequestRouter): IHandlerType[] { 
        return [ ExampleHandler, ExampleHandler ]; 
    }

    handle(): void {
        throw new Error('Method not implemented.');
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

    it('can union resources', () => {
        
    });
    
    it('can be unit tested', () => {
        
        const tableHandler = new ExampleHandler;
        
        tableHandler.resources.flowResultTable.tableName = new MockEnvironmentVariable('MyTable');
        tableHandler.resources.flowResultTable.documentClient = new DocumentClient;

        tableHandler.resources.exchangeTopic.topicArn = new MockEnvironmentVariable('MyTopicArn');
        tableHandler.resources.exchangeTopic.sns = new SNS;
        
        tableHandler.handle();
    });
    

    it.only('can be reflected upon and exercised', () => {
        
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

        const exampleHandler = handlerFactory.build(ExampleHandler);
        
        if ('resources' in exampleHandler) {
            console.log(JSON.stringify(exampleHandler.resources));
        }

        const compositeHandler = handlerFactory.build(CompositeHandler);

        const compositeHandlerTypes = compositeHandler.getHandlerTypes(new RequestRouter);
        
        const resourceList: IResource[] = [];

        compositeHandlerTypes.forEach(handlerType => {

            const handler: any = handlerFactory.build(handlerType);

            // TODO 24May20: We also need to check each handler for triggers, that result in events

            if (handler.resources !== undefined) {
                for (const resourceName in handler.resources) {
                    if (Object.prototype.hasOwnProperty.call(handler.resources, resourceName)) {
                        
                        const resource = handler.resources[resourceName];
                        const resourcePolicy = resource.getPolicy();
    
                        if (!resourceList.some(r => deepEqual(r.getPolicy(), resourcePolicy))) {
                            resourceList.push(resource);
                        } else {
                            console.log('Duplicate');
                        }           
                    }
                }        
            }
        });

        // Exercise the handler
        
        process.env.FLOW_RESULT_TABLE_NAME = 'MyTable';
        process.env.FLOW_EXCHANGE_TOPIC_ARN = 'MyTopicArn';
        
        exampleHandler.handle();
    });
});
