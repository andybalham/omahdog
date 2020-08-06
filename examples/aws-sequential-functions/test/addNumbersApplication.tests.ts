import fs from 'fs';
import YAML from 'yaml';
import path from 'path';
import { expect } from 'chai';
import { getRequiredPolicies, getEnvironmentVariables } from '../src/omahdog-aws/samTemplateFunctions';
import { addNumbersApplication } from '../src/addNumbersApplication';

describe('Lambda application tests', () => {

    it('can be validated', () => {
        
        // Arrange

        const baseTemplateFilePath = path.join(__dirname, '../templateBase.yaml');
        const baseTemplateContent = fs.readFileSync(baseTemplateFilePath, 'utf8');
        const baseTemplate = YAML.parse(baseTemplateContent);
        
        // Act

        // TODO 02Jul20: What about references to generated references? Also, the reference to ApiGateway doesn't seem to validate
        // TODO 02Jul20: Need to ensure any template names are also validated

        const errors = addNumbersApplication.validate(baseTemplate);

        // Assert

        console.log(`Errors:\n- ${errors.join('\n- ')}`);

        expect(errors).to.be.empty;
    });

    it('can return policies', () => {
        
        // Arrange

        // Act

        const policies = addNumbersApplication.getFunctionProperties(getRequiredPolicies);

        // Assert

        policies.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it('can return environment variables', () => {
        
        // Arrange

        // Act

        const environmentVariables = addNumbersApplication.getFunctionProperties(getEnvironmentVariables);

        // Assert

        environmentVariables.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it('can return events', () => {
        
        // Arrange

        // Act

        const events = addNumbersApplication.getFunctionEvents();

        // Assert

        events.forEach((policy, resourceName) => {
            console.log(`${resourceName}:\n${JSON.stringify(policy)}`);
        });
    });

    it('can return function definitions', () => {
        
        // Arrange

        // Act

        const functionDefinitions = addNumbersApplication.getFunctionDefinitions();

        // Assert

        console.log(YAML.stringify(functionDefinitions));
    });

    it('can return generate template', () => {
        
        // Arrange

        const baseTemplateFilePath = path.join(__dirname, '../templateBase.yaml');
        const baseTemplateContent = fs.readFileSync(baseTemplateFilePath, 'utf8');
        const baseTemplate = YAML.parse(baseTemplateContent);
        
        // Act

        const template = addNumbersApplication.getTemplate(baseTemplate);

        // Assert

        const generatedTemplateFilePath = path.join(__dirname, '../templateGenerated.yaml');
        const generatedTemplateContent = YAML.stringify(template);
        fs.writeFileSync(generatedTemplateFilePath, generatedTemplateContent, 'utf8');
    });
});