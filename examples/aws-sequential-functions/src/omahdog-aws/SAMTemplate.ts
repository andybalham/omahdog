import { IActivityRequestHandlerBase, RequestRouter, HandlerFactory } from '../omahdog/FlowContext';
import { ApiControllerRoutes } from './ApiControllerLambda';
import { RequestHandlerLambda } from './ActivityRequestHandlerLambda';

// ------------------------------------------------------------------------------------------------------------------
export abstract class LambdaBase{
    
    readonly resourceName: string;
    functionNameTemplate: string;

    constructor(resourceName: string) {
        this.resourceName = resourceName;
    }
}
export class ApiControllerLambda extends LambdaBase {

    restApiId: TemplateReference;

    constructor(apiControllerType: new () => ApiControllerRoutes, initialise?: (lambda: ApiControllerLambda) => void) {

        super(`${apiControllerType.name}Function`);

        if (initialise !== undefined) {
            initialise(this);            
        }
    }
}

export class LambdaApplication {

    defaultFunctionNamePrefix: string;

    private readonly requestRouter: RequestRouter;
    private readonly handlerFactory: HandlerFactory;

    constructor(requestRouter: RequestRouter, handlerFactory: HandlerFactory, initialise: (LambdaApplication: LambdaApplication) => void) {
        
        this.requestRouter = requestRouter;
        this.handlerFactory = handlerFactory;

        initialise(this);
    }

    addApiController(lambda: ApiControllerLambda): LambdaApplication {
        return this;
    }

    async handleApiEvent(apiControllerRoutesType: new () => ApiControllerRoutes, event: any): Promise<any> {
        throw new Error('Method not implemented.');
    }

    private readonly requestHandlerLambdas = new Map<string, RequestHandlerLambda>();

    addRequestHandler(lambda: RequestHandlerLambda): LambdaApplication {
        if (lambda.handlerType === undefined) throw new Error('lambda.requestHandlerType === undefined');
        this.requestHandlerLambdas.set(lambda.handlerType.name, lambda);
        return this;
    }

    async handleRequestEvent(handlerType: new () => IActivityRequestHandlerBase, event: any): Promise<any> {
        const requestHandlerLambda = this.requestHandlerLambdas.get(handlerType.name);
        if (requestHandlerLambda === undefined) throw new Error('requestHandlerLambda === undefined');
        const response = await requestHandlerLambda.handle(event, this.requestRouter, this.handlerFactory);        
        return response;
    }
}
// ------------------------------------------------------------------------------------------------------------------

export abstract class ConfigurationValue {
    abstract get value(): string | undefined;
}

export class EnvironmentVariable extends ConfigurationValue {
    
    readonly templateReference: TemplateReference;
    readonly variableName: string;

    constructor(resourceReference: TemplateReference, variableName?: string) {
        super();
        this.templateReference = resourceReference;
        this.variableName = variableName ?? this.generateVariableName();
    }
    
    get value(): string | undefined {
        return process.env[this.variableName];
    }

    private generateVariableName(): string {
        // TODO 26May20: Generate a variable name, if one is not supplied
        throw new Error('Implement this');
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
    abstract get instance(): any;
}

export class FunctionReference extends TemplateReference {
    readonly requestHandlerType?: new () => IActivityRequestHandlerBase;
    constructor(requestHandlerType?: new () => IActivityRequestHandlerBase) {
        super(FunctionReference);
        this.requestHandlerType = requestHandlerType;
    }
    get instance(): any { return { 'Ref': `${this.requestHandlerType?.name}Function` }; }
}

export class ResourceReference extends TemplateReference {
    readonly resourceName?: string;
    constructor(resourceName?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
    }
    get instance(): any { return { 'Ref': this.resourceName }; }
}

export class ParameterReference extends TemplateReference {
    readonly parameterName?: string;
    constructor(parameterName?: string) {
        super(ParameterReference);
        this.parameterName = parameterName;
    }
    get instance(): any { return { 'Ref': this.parameterName }; }
}

export class ResourceAttributeReference extends TemplateReference {
    readonly resourceName?: string;
    readonly attributeName?: string;
    constructor(resourceName?: string, attributeName?: string) {
        super(ResourceAttributeReference);
        this.resourceName = resourceName;
        this.attributeName = attributeName;
    }
    get instance(): any { return { 'Fn:Attr': [ this.resourceName, this.attributeName] }; }
}