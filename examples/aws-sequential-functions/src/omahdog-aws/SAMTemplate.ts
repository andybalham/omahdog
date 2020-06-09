import { APIGatewayProxyEvent, SNSEvent } from 'aws-lambda';

import { IActivityRequestHandlerBase, ICompositeRequestHandler, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';

import { ApiControllerRoutes, ApiControllerLambda } from './ApiControllerLambda';
import { RequestHandlerLambda } from './RequestHandlerLambda';
import { ExchangeRequestMessage } from './Exchange';
import { ExchangeMessagePublisher } from './ExchangeMessagePublisher';
import { FunctionInstanceRepository } from './FunctionInstanceRepository';
import { IService } from './IService';

export abstract class LambdaBase {
    
    readonly resourceName: string;
    functionNameTemplate: string;

    constructor(resourceName: string) {
        this.resourceName = resourceName;
    }

    abstract validate(): string[];
    
    abstract throwErrorIfInvalid(): void;
}

export class LambdaApplication {

    defaultFunctionNamePrefix: string;
    defaultResponsePublisher: ExchangeMessagePublisher;
    defaultFunctionInstanceRepository: FunctionInstanceRepository;

    private readonly apiControllerLambdas = new Map<string, ApiControllerLambda>();
    private readonly requestHandlerLambdas = new Map<string, RequestHandlerLambda>();

    private readonly requestRouter: RequestRouter;
    private readonly handlerFactory: HandlerFactory;

    constructor(requestRouter: RequestRouter, handlerFactory: HandlerFactory, initialise: (LambdaApplication: LambdaApplication) => void) {
        
        this.requestRouter = requestRouter;
        this.handlerFactory = handlerFactory;

        initialise(this);
    }    
    
    // TODO 07Jun20: We will eventually pass in the base template for verification
    validate(): string[] {
        
        let errors: string[] = [];

        // TODO 07Jun20: Iterate over the api controllers, as they would be when handling events

        this.requestHandlerLambdas.forEach((handlerLambda: RequestHandlerLambda, handlerTypeName: string) => {

            const requestHandlerLambda = this.getRequestHandlerLambda(handlerTypeName);

            errors = errors.concat(this.validateServices(requestHandlerLambda, requestHandlerLambda.resourceName));

            const handlers = this.getHandlers(requestHandlerLambda.requestHandlerType);

            handlers.forEach((handler, typeName) => {
                errors = errors.concat(this.validateServices(handler, `${requestHandlerLambda.resourceName}.${typeName}`));
            });
        });

        return errors;
    }

    private validateServices(targetObject: any, messagePrefix: string): string[] {
        
        let errorMessages: string[] = [];

        if ('services' in targetObject) {
            
            const services = targetObject.services;

            for (const serviceName in services) {
                if (Object.prototype.hasOwnProperty.call(services, serviceName)) {                    
                    const service: IService = services[serviceName];
                    const serviceErrorMessages = service.validate();
                    errorMessages = errorMessages.concat(
                        serviceErrorMessages.map(message => `${messagePrefix}.services.${serviceName}: ${message}`));
                }
            }
        }

        return errorMessages;
    }

    private getHandlers(requestHandlerType: new () => IActivityRequestHandlerBase): Map<string, IActivityRequestHandlerBase> {

        const requestHandlers = new Map<string, IActivityRequestHandlerBase>();

        const requestHandler = this.handlerFactory.newHandler(requestHandlerType);

        requestHandlers.set(requestHandlerType.name, requestHandler);

        const subHandlers = this.getSubHandlers(requestHandler);
        
        subHandlers.forEach((handler, typeName) => {
            requestHandlers.set(typeName, handler);            
        });
        
        return requestHandlers;
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

    addRequestHandler(lambda: RequestHandlerLambda): LambdaApplication {
        
        if (lambda.requestHandlerType === undefined) throw new Error('lambda.requestHandlerType === undefined');
        
        if (lambda.services.responsePublisher.validate()[0] === 'null' && this.defaultResponsePublisher !== undefined) {
            lambda.services.responsePublisher = this.defaultResponsePublisher;
        }
        
        if (lambda.services.functionInstanceRepository.validate()[0] === 'null' && this.defaultFunctionInstanceRepository !== undefined) {
            lambda.services.functionInstanceRepository = this.defaultFunctionInstanceRepository;
        }

        this.requestHandlerLambdas.set(lambda.requestHandlerType.name, lambda);
        
        return this;
    }

    async handleRequestEvent(handlerType: new () => IActivityRequestHandlerBase, event: SNSEvent | ExchangeRequestMessage): Promise<any> {
        
        const requestHandlerLambda = this.getRequestHandlerLambda(handlerType.name);

        const response = await requestHandlerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
    }

    private getRequestHandlerLambda(handlerTypeName: string): RequestHandlerLambda {

        const requestHandlerLambda = this.requestHandlerLambdas.get(handlerTypeName);

        if (requestHandlerLambda === undefined) throw new Error('requestHandlerLambda === undefined');

        return requestHandlerLambda;
    }
}

// TODO 03Jun20: Can we have a value that comes from SSM?
// TODO 03Jun20: If we do, then we would have to infer the correct policy from 

export abstract class ConfigurationValue {
    abstract get value(): string | undefined;
}

export class EnvironmentVariable extends ConfigurationValue {
    
    readonly templateReference: TemplateReference;
    readonly variableName: string;

    constructor(templateReference: TemplateReference, variableName?: string) {
        super();
        this.templateReference = templateReference;
        this.variableName = variableName ?? this.generateVariableName(templateReference);
    }
    
    get value(): string | undefined {
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

export class ConstantValue extends ConfigurationValue {
    private readonly constantValue?: string;
    
    constructor(constantValue?: string) {
        super();
        this.constantValue = constantValue;
    }

    get value(): string | undefined {
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

export class FunctionReference extends TemplateReference {
    readonly requestHandlerType?: new () => IActivityRequestHandlerBase;
    constructor(requestHandlerType?: new () => IActivityRequestHandlerBase) {
        super(FunctionReference);
        this.requestHandlerType = requestHandlerType;
    }
    get name(): string | undefined { return `${this.requestHandlerType?.name}Function`; }
    get instance(): any { return { 'Ref': this.name }; }
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