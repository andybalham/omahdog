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

    attribute(attributeName: string): ResourceReferenceAttribute {
        return new ResourceReferenceAttribute(this, attributeName);
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

export class ResourceReferenceAttribute extends TemplateReference {

    readonly resourceReference?: ResourceReference;
    readonly attributeName?: string;

    constructor(resourceReference?: ResourceReference, attributeName?: string) {
        super(ResourceReferenceAttribute);
        this.resourceReference = resourceReference;
        this.attributeName = attributeName;
    }

    get name(): string | undefined { return `${this.resourceReference?.name}${this.attributeName}`; }
    get instance(): any { return { 'Fn:Attr': [ this.resourceReference?.name, this.attributeName] }; }
}

