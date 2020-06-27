import { APIGatewayProxyEvent, SNSEvent } from 'aws-lambda';
import deepEqual from 'deep-equal';

import { IActivityRequestHandlerBase, ICompositeRequestHandler, RequestRouter, HandlerFactory, IActivityRequestHandler } from '../omahdog/FlowContext';

import { ApiControllerRoutes, ApiControllerLambda } from './ApiControllerLambda';
import { RequestHandlerLambdaBase, RequestHandlerLambda } from './RequestHandlerLambda';
import { ExchangeRequestMessage } from './Exchange';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IFunctionInstanceRepository } from './FunctionInstanceRepository';
import { validateConfiguration, getRequiredPolicies, getEnvironmentVariables, getEvents } from './samTemplateFunctions';
import { TemplateReference, ResourceReference } from './TemplateReferences';

export class LambdaApplication {

    defaultFunctionNamePrefix: string;
    defaultRequestTopic: TemplateReference;
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
    
    validate(): string[] {
        
        // TODO 07Jun20: We will eventually pass in the base template for verification

        let errors: string[] = [];

        const allRequestHandlers = this.getAllRequestHandlers();

        this.requestHandlerLambdas.forEach((lambda: RequestHandlerLambdaBase) => {
            const lambdaErrors = validateConfiguration(lambda, lambda.resourceName);
            errors = errors.concat(lambdaErrors);
        });

        allRequestHandlers.forEach((handler, handlerTypeName) => {
            const serviceErrors = validateConfiguration(handler, handlerTypeName);
            errors = errors.concat(serviceErrors);                        
        });

        return errors;
    }

    getFunctionDefinitions(): any {

        // TODO 19Jun20: Need to do triggers

        const policiesByResource = this.getFunctionProperties(getRequiredPolicies);
        const environmentVariablesByResource = this.getFunctionProperties(getEnvironmentVariables);
        const eventsByResource = this.getFunctionEvents();

        const resources: any = {};

        function addFunctionResource(resourceName: string, handlerFunctionName: string): void {

            const resourcePolicies = deduplicate(policiesByResource.get(resourceName));
            const resourceEnvironmentVariables = deduplicate(environmentVariablesByResource.get(resourceName));
            const resourceEvents = eventsByResource.get(resourceName);

            const resourceDefinition = {
                Type: 'AWS::Serverless::Function',
                Properties: {
                    FunctionName: `TODO-${resourceName}`,
                    Handler: `lambdas.${handlerFunctionName}`,
                    Environment: {
                        Variables: {}
                    },
                    Policies: resourcePolicies,
                    Events: resourceEvents
                }
            };

            (resourceEnvironmentVariables ?? []).forEach((environmentVariable: any) => {
                const definitionEnvironmentVariables = (resourceDefinition.Properties.Environment.Variables as any);
                definitionEnvironmentVariables[environmentVariable.name] = environmentVariable.value;
            });

            resources[resourceName] = resourceDefinition;
        }

        this.apiControllerLambdas.forEach(lambda => {
            addFunctionResource(lambda.resourceName, lambda.apiControllerRoutesType.name);            
        });

        this.requestHandlerLambdas.forEach(lambda => {
            addFunctionResource(lambda.resourceName, lambda.handlerType.name);            
        });

        return resources;
    }
    
    getFunctionProperties(getProperties: (target: object) => any[]): Map<string, any> {

        const propertiesByResource = new Map<string, any>();

        this.apiControllerLambdas.forEach((lambda) => {

            let properties = getProperties(lambda);

            const handlers = new Map<string, IActivityRequestHandlerBase>();

            const handlerTypes = lambda.apiControllerRoutes.getHandlerTypes();
            handlerTypes.forEach(handlerType => {
                this.addRequestHandlers(handlerType, handlers);
            });

            handlers.forEach(handler => {
                properties = properties.concat(getProperties(handler));
            });

            propertiesByResource.set(lambda.resourceName, properties);
        });

        this.requestHandlerLambdas.forEach(lambda => {

            let properties = getProperties(lambda);

            const handlers = new Map<string, IActivityRequestHandlerBase>();

            this.addRequestHandlers(lambda.handlerType, handlers);

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

            const handlers = new Map<string, IActivityRequestHandlerBase>();
            this.addRequestHandlers(lambda.handlerType, handlers);

            handlers.forEach(handler => {
                const handlerEvents = getEvents(handler, lambda.handlerType.name);
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
                this.addRequestHandlers(handlerType, allRequestHandlers);
            });
        });

        this.requestHandlerLambdas.forEach((lambda: RequestHandlerLambdaBase) => {
            this.addRequestHandlers(lambda.handlerType, allRequestHandlers);
        });

        return allRequestHandlers;
    }

    private addRequestHandlers(requestHandlerType: new () => IActivityRequestHandlerBase, requestHandlers: Map<string, IActivityRequestHandlerBase>): void {

        const requestHandler = this.handlerFactory.newHandler(requestHandlerType);

        requestHandlers.set(requestHandlerType.name, requestHandler);

        const subHandlers = this.getSubHandlers(requestHandler);
        
        subHandlers.forEach((handler, typeName) => {
            requestHandlers.set(typeName, handler);            
        });
    }

    private getSubHandlers(requestHandler: IActivityRequestHandlerBase): Map<string, IActivityRequestHandlerBase> {

        const subHandlers = new Map<string, IActivityRequestHandlerBase>();

        if ('getSubRequestTypes' in requestHandler) {

            const subRequestTypes = (requestHandler as ICompositeRequestHandler).getSubRequestTypes();

            subRequestTypes.forEach(subRequestType => {
                
                const subHandlerType = this.requestRouter.getHandlerType(subRequestType);                    
                const subHandler = this.handlerFactory.newHandler(subHandlerType);

                subHandlers.set(subHandlerType.name, subHandler);

                this.getSubHandlers(subHandler).forEach((handler, typeName) => {
                    subHandlers.set(typeName, handler);                    
                });
            });
        }

        return subHandlers;
    }

    addApiController(apiGatewayReference: TemplateReference, apiControllerRoutesType: new () => ApiControllerRoutes, initialise?: (lambda: ApiControllerLambda) => void): LambdaApplication {
        const lambda = new ApiControllerLambda(apiGatewayReference, apiControllerRoutesType, initialise);
        this.apiControllerLambdas.set(lambda.apiControllerRoutesType.name, lambda);
        return this;
    }

    async handleApiEvent(apiControllerRoutesType: new () => ApiControllerRoutes, event: APIGatewayProxyEvent): Promise<any> {
        const apiControllerLambda = this.apiControllerLambdas.get(apiControllerRoutesType.name);
        if (apiControllerLambda === undefined) throw new Error('apiControllerLambda === undefined');
        const response = await apiControllerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
    }

    addRequestHandler<TReq, TRes, THan extends IActivityRequestHandler<TReq, TRes>>(functionReference: TemplateReference, 
        requestType: new () => TReq, responseType: new () => TRes, handlerType: new () => THan, 
        initialise?: (lambda: RequestHandlerLambda<TReq, TRes, THan>) => void): LambdaApplication {

        const lambda = 
            new RequestHandlerLambda(functionReference, requestType, responseType, handlerType, initialise);
        
        lambda.parameters.requestTopic = 
            lambda.parameters.requestTopic ?? this.defaultRequestTopic;
        lambda.services.responsePublisher = 
            lambda.services.responsePublisher ?? this.defaultResponsePublisher;
        lambda.services.functionInstanceRepository = 
            lambda.services.functionInstanceRepository ?? this.defaultFunctionInstanceRepository;

        this.requestHandlerLambdas.set(lambda.requestType.name, lambda);

        return this;
    }

    async handleRequestEvent(requestType: new () => any, event: SNSEvent | ExchangeRequestMessage): Promise<any> {
        const requestHandlerLambda = this.requestHandlerLambdas.get(requestType.name);
        if (requestHandlerLambda === undefined) throw new Error('requestHandlerLambda === undefined');
        const response = await requestHandlerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
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
