import { Type } from '../omahdog/Type';

export abstract class TemplateReference {
    
    readonly isTemplateReference = true;
    readonly typeName: string;

    constructor(type: Type<TemplateReference>) {
        this.typeName = type.name;
    }
    
    abstract get name(): string | undefined;
    abstract get instance(): any;
    abstract validate(baseTemplate: any): string[];
}

export class ResourceReference extends TemplateReference {
    
    readonly isResourceReference = true;
    readonly resourceName?: string;
    readonly resourceType?: string;

    constructor(resourceName?: string, resourceType?: string) {
        super(ResourceReference);
        this.resourceName = resourceName;
        this.resourceType = resourceType;
    }

    static new(resourceName: string, resourceType: string): ResourceReference {
        return new ResourceReference(resourceName, resourceType);
    }

    static awsServerlessApi(resourceName: string): ResourceReference {
        return new ResourceReference(resourceName, 'AWS::Serverless::Api');
    }

    static awsServerlessSimpleTable(resourceName: string): ResourceReference {
        return new ResourceReference(resourceName, 'AWS::Serverless::SimpleTable');
    }

    static awsSNSTopic(resourceName: string): ResourceReference {
        return new ResourceReference(resourceName, 'AWS::SNS::Topic');
    }

    static awsServerlessFunction(resourceName: string): ResourceReference {
        return new ResourceReference(resourceName, 'AWS::Serverless::Function');
    }

    get name(): string | undefined { return this.resourceName; }
    get instance(): any { return { 'Ref': this.name }; }

    validate(baseTemplate: any): string[] {

        const targetResource = baseTemplate.Resources[this.name ?? 'undefined'];

        if (targetResource === undefined) {
            return [`Resource reference '${this.name}' is undefined in the template`];
        }

        if ((this.resourceType !== undefined)
            && (this.resourceType !== targetResource.Type)) {

            return [`Resource reference '${this.name}' has type '${this.resourceType}', whilst the template resource has type '${targetResource.Type}'`];
        }

        return [];
    }    

    attribute(attributeName: string): ResourceReferenceAttribute {
        return new ResourceReferenceAttribute(this, attributeName);
    }
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
    get instance(): any { return { 'Fn::GetAtt': [ this.resourceReference?.name, this.attributeName] }; }

    validate(baseTemplate: any): string[] {
        
        return this.resourceReference !== undefined
            ? this.resourceReference.validate(baseTemplate)
            : [];
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

    validate(baseTemplate: any): string[] {        
        return (baseTemplate.Parameters[this.name ?? 'undefined'] === undefined) 
            ? [ `baseTemplate.Parameters[${this.name}] === undefined`] : [];
    }    
}

