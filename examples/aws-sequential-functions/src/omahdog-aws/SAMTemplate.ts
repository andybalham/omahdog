import { IActivityRequestHandlerBase } from '../omahdog/FlowContext';
import { ApiControllerRoutes } from './ApiControllerLambda';

// ------------------------------------------------------------------------------------------------------------------
export abstract class LambdaBase{
    resourceName: string;
    functionNameTemplate: string;
    constructor(type: new () => any) {
        this.resourceName = `${type.name}Function`;
    }
}
export class RequestHandlerLambda extends LambdaBase {
    constructor(requestHandlerType: new () => IActivityRequestHandlerBase, initialise?: (lambda: RequestHandlerLambda) => void) {
        super(requestHandlerType);
        if (initialise !== undefined) {
            initialise(this);            
        }
    }
}
export class ApiControllerLambda extends LambdaBase {
    restApiId: TemplateReference;
    constructor(apiControllerType: new () => ApiControllerRoutes, initialise?: (lambda: ApiControllerLambda) => void) {
        super(apiControllerType);
        if (initialise !== undefined) {
            initialise(this);            
        }
    }
}

export class LambdaApplication {

    exchangeMessagePublisher?: any;
    functionInstanceRepository?: any;
    defaultFunctionNamePrefix: string;

    constructor(requestRouter: any, handlerFactory: any, initialise: (LambdaApplication: LambdaApplication) => void) {
        initialise(this);
    }

    addApiController(lambda: ApiControllerLambda): LambdaApplication {
        return this;
    }

    addRequestHandler(lambda: RequestHandlerLambda): LambdaApplication {
        return this;
    }

    async handleRequestEvent(handlerType: new () => IActivityRequestHandlerBase, event: any): Promise<any> {
        throw new Error('Method not implemented.');
    }

    async handleApiEvent(apiControllerRoutesType: new () => ApiControllerRoutes, event: any): Promise<any> {
        throw new Error('Method not implemented.');
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
    readonly resourceName?: string;
    constructor(lambda?: LambdaBase) {
        super(ResourceReference);
        this.resourceName = lambda?.resourceName;
    }
    get instance(): any { return { 'Ref': this.resourceName }; }
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