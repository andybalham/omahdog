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

export function getRequiredPolicies(targetObject: any): any[] {
        
    let policies: any[] = [];

    const getMethodName = 'getPolicies';

    if (getMethodName in targetObject) {
        policies = policies.concat(targetObject[getMethodName]());
    }

    function addPolicies(configObject: any, policies: any[]): any[] {

        for (const configProperty in configObject ?? {}) {            
            const configPolicies = getRequiredPolicies(configObject[configProperty]);
            policies = policies.concat(configPolicies);
        }
    
        return policies;
    }
        
    policies = addPolicies(targetObject.parameters, policies);
    policies = addPolicies(targetObject.services, policies);

    return policies;
}

export function getEnvironmentVariables(targetObject: any): any[] {
        
    let environmentVariables: any[] = [];

    for (const parameterName in targetObject.parameters ?? {}) {
        const parameter = targetObject.parameters[parameterName];
        if ('getEnvironmentVariableDefinition' in parameter) {
            environmentVariables.push(parameter.getEnvironmentVariableDefinition());
        }
    }            

    for (const serviceName in targetObject.services ?? {}) {
        const service = targetObject.services[serviceName];        
        const serviceEnvironmentVariables = getEnvironmentVariables(service);
        environmentVariables = environmentVariables.concat(serviceEnvironmentVariables);
    }

    return environmentVariables;
}

export function throwErrorIfInvalid(targetObject: any, getPrefix: () => string): void {
    const errorMessages = validateConfiguration(targetObject);
    if (errorMessages.length > 0) {
        throw new Error(`${getPrefix()} is not valid:\n${errorMessages.join('\n')}`);
    }
}