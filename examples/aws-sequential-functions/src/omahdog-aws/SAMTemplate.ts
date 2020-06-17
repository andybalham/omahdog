import { APIGatewayProxyEvent, SNSEvent } from 'aws-lambda';

import { IActivityRequestHandlerBase, ICompositeRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';

import { ApiControllerRoutes, ApiControllerLambda } from './ApiControllerLambda';
import { RequestHandlerLambda, RequestHandlerLambdaBase } from './RequestHandlerLambda';
import { ExchangeRequestMessage } from './Exchange';
import { IExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { IFunctionInstanceRepository } from './FunctionInstanceRepository';

export abstract class LambdaBase {
    
    readonly resourceName: string;
    functionNameTemplate: string;

    constructor(resourceName: string) {
        this.resourceName = resourceName;
    }
}

export function validateConfiguration(targetObject: any, errorPrefix = ''): string[] {
        
    let errorMessages: string[] = [];

    if ('validate' in targetObject) {        
        const targetObjectErrorMessages: string[] = targetObject.validate();
        errorMessages = 
            errorMessages.concat(targetObjectErrorMessages.map(errorMessage => `${errorPrefix}: ${errorMessage}`));
    }
    
    errorMessages = addConfigurationErrors(targetObject['parameters'], errorPrefix, errorMessages);
    errorMessages = addConfigurationErrors(targetObject['services'], errorPrefix, errorMessages);

    return errorMessages;
}

function addConfigurationErrors(configObject: any, errorPrefix: string, errorMessages: string[]): string[] {

    for (const configProperty in configObject ?? {}) {
        
        const config = configObject[configProperty];
        const configErrorPrefix = `${errorPrefix}.${configProperty}`;
        const configErrorMessages = validateConfiguration(config, configErrorPrefix);

        errorMessages = errorMessages.concat(configErrorMessages);
    }

    return errorMessages;
}

export function getPolicies(targetObject: any): any[] {
        
    let policies: any[] = [];

    if ('getPolicies' in targetObject) {        
        policies = policies.concat(targetObject.getPolicies());
    }
    
    policies = addPolicies(targetObject['parameters'], policies);
    policies = addPolicies(targetObject['services'], policies);

    return policies;
}

function addPolicies(configObject: any, policies: any[]): any[] {

    for (const configProperty in configObject ?? {}) {
        
        const config = configObject[configProperty];
        const configPolicies = getPolicies(config);

        policies = policies.concat(configPolicies);
    }

    return policies;
}

export function throwErrorIfInvalid(targetObject: any, getPrefix: () => string): void {
    const errorMessages = validateConfiguration(targetObject);
    if (errorMessages.length > 0) {
        throw new Error(`${getPrefix()} is not valid:\n${errorMessages.join('\n')}`);
    }
}

export class LambdaApplication {

    defaultFunctionNamePrefix: string;
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
        
        // TODO 17Jun20: We need to de-duplicate the policies using deepEqual
        
        const allPolicies = this.getPolicies();

        const resources: any = {};

        this.requestHandlerLambdas.forEach(lambda => {

            const resourceDefinition = {
                Type: 'AWS::Serverless::Function',
                Properties: {
                    FunctionName: `TODO-${lambda.resourceName}`,
                    Handler: `lambdas.${lambda.handlerType.name}`,
                    Environment: {
                        Variables: {
                            FLOW_EXCHANGE_TOPIC: {
                                Ref: 'TODO'
                            }
                        }
                    },
                    Policies: allPolicies.get(lambda.resourceName),
                    Events: [ 'TODO' ]
                }
            };

            resources[lambda.resourceName] = resourceDefinition;
        });

        return resources;
    }

    getPolicies(): Map<string, any> {

        const allPolicies = new Map<string, any>();

        // TODO 16Jun20: Need to deduplicate the policies within a resource using deepEqual

        this.apiControllerLambdas.forEach((lambda) => {

            let policies = new Array<any>();

            const handlerTypes = lambda.apiControllerRoutes.getHandlerTypes();
            const handlers = new Map<string, IActivityRequestHandlerBase>();

            handlerTypes.forEach(handlerType => {
                this.addRequestHandlers(handlerType, handlers);
            });

            handlers.forEach(handler => {
                policies = policies.concat(getPolicies(handler));
            });

            allPolicies.set(lambda.resourceName, policies);
        });

        this.requestHandlerLambdas.forEach(lambda => {

            let policies = getPolicies(lambda);

            const handlers = new Map<string, IActivityRequestHandlerBase>();
            this.addRequestHandlers(lambda.handlerType, handlers);

            handlers.forEach(handler => {
                policies = policies.concat(getPolicies(handler));
            });

            allPolicies.set(lambda.resourceName, policies);
        });

        return allPolicies;
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

    addApiController(lambda: ApiControllerLambda): LambdaApplication {
        if (lambda.apiControllerRoutesType === undefined) throw new Error('lambda.apiControllerRoutesType === undefined');
        this.apiControllerLambdas.set(lambda.apiControllerRoutesType.name, lambda);
        return this;
    }

    async handleApiEvent(apiControllerRoutesType: new () => ApiControllerRoutes, event: APIGatewayProxyEvent): Promise<any> {
        const apiControllerLambda = this.apiControllerLambdas.get(apiControllerRoutesType.name);
        if (apiControllerLambda === undefined) throw new Error('apiControllerLambda === undefined');
        const response = await apiControllerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
    }

    addRequestHandler(lambda: RequestHandlerLambdaBase): LambdaApplication {
        
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

// TODO 03Jun20: Can we have a value that comes from SSM?
// TODO 03Jun20: If we do, then we would have to infer the correct policy from it

export interface IConfigurationValue {    
    getValue(): string | undefined;
    validate(): string[];
}

export class EnvironmentVariable implements IConfigurationValue {
    
    readonly templateReference: TemplateReference;
    readonly variableName: string;

    constructor(templateReference: TemplateReference, variableName?: string) {
        this.templateReference = templateReference;
        this.variableName = variableName ?? this.generateVariableName(templateReference);
    }
    
    validate(): string[] {
        return this.templateReference === undefined ? ['this.templateReference === undefined'] : [];
    }
    
    getValue(): string | undefined {
        const value = process.env[this.variableName];
        if (value === undefined) {
            console.log(`process.env[${this.variableName}] === undefined`);
        }
        return value;
    }

    private generateVariableName(templateReference: TemplateReference): string {
        const variableName = templateReference.name?.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
        return variableName ?? 'undefined';
    }
}

export class ConstantValue implements IConfigurationValue {
    private readonly constantValue?: string;
    
    constructor(constantValue?: string) {
        this.constantValue = constantValue;
    }
    
    validate(): string[] {
        return this.constantValue === undefined ? ['this.constantValue === undefined'] : [];
    }

    getValue(): string | undefined {
        return this.constantValue;
    }
}

export abstract class TemplateReference {
    readonly typeName: string;
    constructor(type: new () => TemplateReference) {
        this.typeName = type.name;
    }
    abstract get name(): string | undefined;
    abstract get instance(): any;
}

export class ResourceReference extends TemplateReference {
    
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }

    get name(): string | undefined { return this.resourceName; }
    get instance(): any { return { 'Ref': this.name }; }

    attribute(attributeName: string): ResourceAttributeReference {
        return new ResourceAttributeReference(this.resourceName, attributeName);
    }
}

export class ParameterReference extends TemplateReference {
    readonly parameterName?: string;
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
    get name(): string | undefined { return this.parameterName; }
    get instance(): any { return { 'Ref': this.name }; }
}

export class ResourceAttributeReference extends TemplateReference {

    readonly resourceName?: string;
    readonly attributeName?: string;

    constructor(resourceName?: string, attributeName?: string) {
        super(ResourceAttributeReference);
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }

    get name(): string | undefined { return `${this.resourceName}${this.attributeName}`; }
    get instance(): any { return { 'Fn:Attr': [ this.resourceName, this.attributeName] }; }
}