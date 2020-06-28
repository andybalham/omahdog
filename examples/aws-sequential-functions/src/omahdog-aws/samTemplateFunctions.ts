export function validateConfiguration(targetObject: any, errorPrefix = ''): string[] {
        
    let errorMessages: string[] = [];

    if (targetObject === undefined) {
        return errorMessages;
    }

    const validateMethodName = 'validate';
    if (validateMethodName in targetObject) {        
        const targetObjectErrorMessages: string[] = targetObject[validateMethodName]();
        errorMessages = 
            errorMessages.concat(targetObjectErrorMessages.map(errorMessage => `${errorPrefix}: ${errorMessage}`));
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
        
    errorMessages = addConfigurationErrors(targetObject.parameters, errorPrefix, errorMessages);
    errorMessages = addConfigurationErrors(targetObject.services, errorPrefix, errorMessages);

    return errorMessages;
}

export function getRequiredPolicies(targetObject: any): any[] {
        
    let policies: any[] = [];

    if (targetObject === undefined) {
        return policies;
    }

    const getPoliciesMethodName = 'getPolicies';
    if (getPoliciesMethodName in targetObject) {
        policies = policies.concat(targetObject[getPoliciesMethodName]());
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

    if (targetObject === undefined) {
        return environmentVariables;
    }

    for (const parameterName in targetObject.parameters ?? {}) {
        
        const parameter = targetObject.parameters[parameterName];
        
        const getEnvironmentVariableDefinitionMethodName = 'getEnvironmentVariableDefinition';
        if (getEnvironmentVariableDefinitionMethodName in parameter) {
            const parameterEnvironmentVariables = parameter[getEnvironmentVariableDefinitionMethodName]();
            environmentVariables.push(parameterEnvironmentVariables);
        }
    }            

    for (const serviceName in targetObject.services ?? {}) {
        const service = targetObject.services[serviceName];        
        const serviceEnvironmentVariables = getEnvironmentVariables(service);
        environmentVariables = environmentVariables.concat(serviceEnvironmentVariables);
    }

    return environmentVariables;
}

export function getEvents(targetObject: any, rootHandlerName: string): any[] {
        
    let events: any[] = [];

    if (targetObject === undefined) {
        return events;
    }

    if (targetObject !== undefined) {

        const getEventsMethodName = 'getEvents';
        if (getEventsMethodName in targetObject) {            
            events = events.concat(targetObject[getEventsMethodName](rootHandlerName));
        }
        
        for (const serviceName in targetObject.services ?? {}) {
            const service = targetObject.services[serviceName];
            const serviceEvents = getEvents(service, rootHandlerName);
            events = events.concat(serviceEvents);
        }    
    }

    return events;
}