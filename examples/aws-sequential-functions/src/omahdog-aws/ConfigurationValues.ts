import { TemplateReference } from './TemplateReferences';

// TODO 03Jun20: Can we have a value that comes from SSM?
// TODO 03Jun20: If we do, then we would have to infer the correct policy from it

export interface IConfigurationValue {
    getValue(): string | undefined;
    validate(): string[];
}

// TODO 20Jun20: We can also have environment variables that are constants
    
export class EnvironmentVariable implements IConfigurationValue {
    
    readonly templateReference?: TemplateReference;
    readonly variableName: string;
    readonly variableValue?: string;

    static newReference(templateReference: TemplateReference): EnvironmentVariable {
        return new EnvironmentVariable(templateReference);
    }

    static newValue(variableName: string, variableValue: string): EnvironmentVariable {
        return new EnvironmentVariable(undefined, variableName, variableValue);
    }

    private constructor(templateReference?: TemplateReference, variableName?: string, variableValue?: string) {
        this.templateReference = templateReference;        
        this.variableName = variableName ?? this.generateVariableName(templateReference);
        this.variableValue = variableValue;
    }
    
    validate(): string[] {
        return (this.templateReference === undefined) && (this.variableValue === undefined) 
            ? ['(this.templateReference === undefined) && (this.variableValue === undefined)'] : [];
    }
    
    getValue(): string | undefined {
        const value = process.env[this.variableName];
        if (value === undefined) {
            console.warn(`process.env[${this.variableName}] === undefined`);
        }
        return value;
    }

    getEnvironmentVariableDefinition(): any {
        const definition: any = {
            name: this.variableName,
            value: this.templateReference === undefined ? this.variableValue : this.templateReference.instance
        };
        return definition;
    }

    private generateVariableName(templateReference?: TemplateReference): string {
        const variableName = templateReference?.name?.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
        return variableName ?? 'UNDEFINED';
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

