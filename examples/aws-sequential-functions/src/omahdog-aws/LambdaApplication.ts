import { APIGatewayProxyEvent, SNSEvent } from 'aws-lambda';
import deepEqual from 'deep-equal';

import { IActivityRequestHandlerBase, ICompositeRequestHandler, RequestRouter, HandlerFactory, IActivityRequestHandler, getRequestHandlers } from '../omahdog/FlowContext';

import { ApiControllerRoutes, ApiControllerLambda } from './ApiControllerLambda';
import { RequestHandlerLambdaBase, RequestHandlerLambda } from './RequestHandlerLambda';
import { FlowRequestMessage } from './FlowMessage';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { validateConfiguration, getRequiredPolicies, getEnvironmentVariables, getEvents } from './samTemplateFunctions';
import { TemplateReference, ResourceReference, ParameterReference } from './TemplateReferences';
import { Type } from '../omahdog/Type';
import { EnvironmentVariable } from './ConfigurationValues';

// TODO 27Jun20: Handle DeadLetterQueues

export class LambdaApplication {

    functionNamePrefix?: string | FunctionNamePrefix;

    defaultResponsePublisher: IExchangeMessagePublisher;    
    defaultFunctionInstanceRepository: IFunctionInstanceRepository;
    
    private readonly apiControllerLambdas = new Map<string, ApiControllerLambda>();
    private readonly requestHandlerLambdas = new Map<string, RequestHandlerLambdaBase>();

    private readonly requestRouter: RequestRouter;
    private readonly handlerFactory: HandlerFactory;

    constructor(requestRouter: RequestRouter, handlerFactory: HandlerFactory, initialise: (LambdaApplication: LambdaApplication) => void) {
        
        this.requestRouter = requestRouter;
        this.handlerFactory = handlerFactory;

        initialise(this);
    }    
    
    validate(baseTemplate: any): string[] {

        this.requestHandlerLambdas.forEach(lambda => {
            baseTemplate.Resources[lambda.resourceName] = { Type: 'AWS::Serverless::Function' };
        });
        
        // TODO 04Jul20: Is there anything else that would need to be validated?

        let errors: string[] = [];

        if (typeof this.functionNamePrefix === 'object') {
            errors = errors.concat(this.functionNamePrefix.validate(baseTemplate));
        }

        this.apiControllerLambdas.forEach(lambda => {
            const lambdaErrors = 
                validateConfiguration(lambda, baseTemplate, this.requestRouter, this.handlerFactory, lambda.resourceName);
            errors = errors.concat(lambdaErrors);
        });

        this.requestHandlerLambdas.forEach(lambda => {
            const lambdaErrors = 
                validateConfiguration(lambda, baseTemplate, this.requestRouter, this.handlerFactory, lambda.resourceName);
            errors = errors.concat(lambdaErrors);
        });

        const allRequestHandlers = this.getAllRequestHandlers();

        allRequestHandlers.forEach((handler, handlerTypeName) => {
            const handlerErrors = 
                validateConfiguration(handler, baseTemplate, this.requestRouter, this.handlerFactory, handlerTypeName);
            errors = errors.concat(handlerErrors);                        
        });

        return errors;
    }

    // TODO 28Jun20: Create a command line tool to invoke the following from a command line

    getTemplate(baseTemplate: any): any {

        const template = JSON.parse(JSON.stringify(baseTemplate));

        const functionDefinitions = this.getFunctionDefinitions();

        for (const resourceName in functionDefinitions) {
            template.Resources[resourceName] = functionDefinitions[resourceName];
        }

        return template;
    }

    getFunctionDefinitions(): any {

        const policiesByResource = this.getFunctionProperties(getRequiredPolicies);
        const environmentVariablesByResource = this.getFunctionProperties(getEnvironmentVariables);
        const eventsByResource = this.getFunctionEvents();

        const resources: any = {};

        const addFunctionResource = 
            (resourceName: string, handledTypeName: string): void => {

                const resourcePolicies = deduplicate(policiesByResource.get(resourceName));
                const resourceEnvironmentVariables = deduplicate(environmentVariablesByResource.get(resourceName));
                const resourceEvents = eventsByResource.get(resourceName);

                const functionName: any = 
                    (this.functionNamePrefix === undefined) 
                        ? resourceName 
                        : (typeof this.functionNamePrefix === 'string') 
                            ? `${this.functionNamePrefix}${resourceName}`
                            : {
                                'Fn::Sub': `${this.functionNamePrefix.getTemplate()}${resourceName}`
                            };
            
                // TODO 28Jun20: Add support for Timeout, DeadLetterQueue, Description, Tags, Runtime(?)

                const resourceDefinition = {
                    Type: 'AWS::Serverless::Function',
                    Properties: {
                        FunctionName: functionName,
                        Handler: `lambdas.handle${handledTypeName}`,
                        Environment: {
                            Variables: {}
                        },
                        Policies: resourcePolicies,
                        Events: resourceEvents
                    }
                };

                const definitionEnvironmentVariables = (resourceDefinition.Properties.Environment.Variables as any);

                definitionEnvironmentVariables['FUNCTION_NAME'] = JSON.parse(JSON.stringify(functionName));
                
                (resourceEnvironmentVariables ?? [])
                    .forEach((environmentVariable: any) => {
                        definitionEnvironmentVariables[environmentVariable.name] = environmentVariable.value;
                    });

                resources[resourceName] = resourceDefinition;
            };

        this.apiControllerLambdas.forEach(lambda => {
            addFunctionResource(lambda.resourceName, lambda.apiControllerRoutesType.name);            
        });

        this.requestHandlerLambdas.forEach(lambda => {
            addFunctionResource(lambda.resourceName, lambda.requestType.name);            
        });

        return resources;
    }
    
    getFunctionProperties(getProperties: (target: object) => any[]): Map<string, any> {

        const propertiesByResource = new Map<string, any>();

        this.apiControllerLambdas.forEach((lambda) => {

            let properties = getProperties(lambda);

            const handlerTypes = lambda.apiControllerRoutes.getHandlerTypes();

            handlerTypes.forEach(handlerType => {

                const handlers = getRequestHandlers(handlerType, this.handlerFactory, this.requestRouter);

                handlers.forEach(handler => {
                    properties = properties.concat(getProperties(handler));
                });    
            });

            propertiesByResource.set(lambda.resourceName, properties);
        });

        this.requestHandlerLambdas.forEach(lambda => {

            let properties = getProperties(lambda);

            const handlers = getRequestHandlers(lambda.handlerType, this.handlerFactory, this.requestRouter);

            handlers.forEach(handler => {
                properties = properties.concat(getProperties(handler));
            });

            propertiesByResource.set(lambda.resourceName, properties);
        });

        return propertiesByResource;
    }
    
    getFunctionEvents(): Map<string, any> {

        const functionEvents = new Map<string, any>();

        this.apiControllerLambdas.forEach((lambda) => {
            
            const events = lambda.getEvents();

            const eventsObject = this.getEventsObject(events);

            functionEvents.set(lambda.resourceName, eventsObject);
        });

        this.requestHandlerLambdas.forEach(lambda => {

            let events = lambda.getEvents();

            const callbackId = lambda.getRequesterId(this.functionNamePrefix);

            const handlers = getRequestHandlers(lambda.handlerType, this.handlerFactory, this.requestRouter);

            handlers.forEach(handler => {
                const handlerEvents = getEvents(handler, callbackId);
                events = events.concat(handlerEvents);
            });

            const eventsObject = this.getEventsObject(events);

            functionEvents.set(lambda.resourceName, eventsObject);
        });

        return functionEvents;
    }

    private getEventsObject(events: any[]): any {

        const eventsObject: any = {};

        const mergedEvents = new Array<any>();
        
        events.forEach((event, eventIndex) => {

            const matchingEventIndex = this.getMatchingEventIndex(event, mergedEvents);

            if (matchingEventIndex === -1) {
                mergedEvents.push(event);
            } else {
                mergedEvents[matchingEventIndex] = this.mergeEvents(mergedEvents[matchingEventIndex], event);
            }
        });

        mergedEvents.forEach((event, eventIndex) => {
            const eventName = `${event.Type}Event${String(eventIndex + 1).padStart(3, '0')}`;
            eventsObject[eventName] = event;
        });

        return eventsObject;
    }

    private getMatchingEventIndex(targetEvent: any, events: any[]): number {

        let matchingEventIndex: number;

        switch (targetEvent.Type) {
        case 'SNS':
            matchingEventIndex = events.findIndex(e => deepEqual(e.Topic, targetEvent.Topic));                
            break;
        
        default:
            matchingEventIndex = events.findIndex(e => deepEqual(e, targetEvent));
            break;
        }

        return matchingEventIndex;
    }
    
    private mergeEvents(event1: any, event2: any): any {

        let mergedEvent: any;

        switch (event1.Type) {
        case 'SNS':
            mergedEvent = this.mergeSNSEvents(event1, event2);
            break;
        
        default:
            mergedEvent = event1;
            break;
        }

        return mergedEvent;
    }

    private mergeSNSEvents(event1: any, event2: any): any {

        const mergedEvent = JSON.parse(JSON.stringify(event1));
        
        const mergedFilterPolicy = mergedEvent.Properties.FilterPolicy;
        const event2FilterPolicy = event2.Properties.FilterPolicy;

        for (const event2AttributeName in event2FilterPolicy) {

            const event2Attribute = event2FilterPolicy[event2AttributeName];

            if (event2AttributeName in mergedFilterPolicy) {

                const mergedAttribute = mergedFilterPolicy[event2AttributeName];

                if (!(Array.isArray(mergedAttribute) && Array.isArray(event2Attribute))) {
                    throw new Error(`The filter policy attributes ${event2AttributeName} cannot be merged, as they are not both arrays`);                    
                }

                // TODO 23Jul20: Do we need to deduplicate the merged attributes?
                const mergedAttributes = (mergedAttribute as any[]).concat(event2Attribute);

                mergedFilterPolicy[event2AttributeName] = mergedAttributes;

            } else {
                
                mergedFilterPolicy[event2AttributeName] = event2Attribute;
            }
        }

        return mergedEvent;
    }

    private getAllRequestHandlers(): Map<string, IActivityRequestHandlerBase> {

        const allRequestHandlers = new Map<string, IActivityRequestHandlerBase>();

        this.apiControllerLambdas.forEach((lambda) => {

            const handlerTypes = lambda.apiControllerRoutes.getHandlerTypes();

            handlerTypes.forEach(handlerType => {
                const handlers = getRequestHandlers(handlerType, this.handlerFactory, this.requestRouter);
                handlers.forEach((handler, handlerTypeName) => {
                    allRequestHandlers.set(handlerTypeName, handler);
                });
            });
        });

        this.requestHandlerLambdas.forEach(lambda => {
            const handlers = getRequestHandlers(lambda.handlerType, this.handlerFactory, this.requestRouter);
            handlers.forEach((handler, handlerTypeName) => {
                allRequestHandlers.set(handlerTypeName, handler);
            });
        });

        return allRequestHandlers;
    }

    addApiController(functionReference: TemplateReference, apiGatewayReference: TemplateReference, 
        apiControllerRoutesType: Type<ApiControllerRoutes>, initialise?: (lambda: ApiControllerLambda) => void): LambdaApplication {
        
        const lambda = new ApiControllerLambda(functionReference, apiGatewayReference, apiControllerRoutesType, initialise);
        this.apiControllerLambdas.set(lambda.apiControllerRoutesType.name, lambda);
        return this;
    }

    async handleApiEvent(apiControllerRoutesType: Type<ApiControllerRoutes>, event: APIGatewayProxyEvent): Promise<any> {
        const apiControllerLambda = this.apiControllerLambdas.get(apiControllerRoutesType.name);
        if (apiControllerLambda === undefined) throw new Error('apiControllerLambda === undefined');
        const response = await apiControllerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
    }

    addRequestHandler<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(functionReference: TemplateReference, 
        requestType: Type<TReq>, responseType: Type<TRes>, handlerType: Type<THan>, 
        initialise?: (lambda: RequestHandlerLambda<TReq, TRes, THan>) => void): LambdaApplication {

        const lambda = 
            new RequestHandlerLambda(functionReference, requestType, responseType, handlerType, initialise);
        
        if (lambda.parameters.requestTopic !== undefined) {
            lambda.services.responsePublisher = lambda.services.responsePublisher ?? this.defaultResponsePublisher;
        }

        if (lambda.hasAsyncHandler(this.requestRouter, this.handlerFactory)) {
            lambda.services.functionInstanceRepository = lambda.services.functionInstanceRepository ?? this.defaultFunctionInstanceRepository;            
        }

        if (this.requestHandlerLambdas.has(lambda.requestType.name)) {
            throw new Error(`A request handler has already been added for the type: ${lambda.requestType.name}`);
        }

        this.requestHandlerLambdas.set(lambda.requestType.name, lambda);

        return this;
    }

    async handleRequestEvent(requestType: Type<any>, event: SNSEvent | FlowRequestMessage): Promise<any> {

        const requestHandlerLambda = this.requestHandlerLambdas.get(requestType.name);
        
        if (requestHandlerLambda === undefined) throw new Error('requestHandlerLambda === undefined');
        
        const response = await requestHandlerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        
        return response;
    }
}

export class FunctionNamePrefix {
    
    readonly separator: string;
    readonly references: ParameterReference[];

    constructor(separator: string, ...references: ParameterReference[]) {
        this.separator = separator;
        this.references = references;
    }

    validate(baseTemplate: any): string[] {
        
        let errorMessages = new Array<string>();

        this.references.forEach(reference => {
            errorMessages = errorMessages.concat(reference.validate(baseTemplate));
        });

        return errorMessages;
    }

    getTemplate(): string {
        const template = this.references.map(p => '${' + p.name + '}').join(this.separator) + this.separator;
        return template;
    }
}

function deduplicate(array: any[]): any[] {

    const deduplicatedArray: any[] = [];

    array.forEach(element => {
        
        const isDuplicate = 
            deduplicatedArray.find(deduplicatedElement => deepEqual(deduplicatedElement, element)) !== undefined;

        if (!isDuplicate) {
            deduplicatedArray.push(element);
        }
    });

    return deduplicatedArray;
}
