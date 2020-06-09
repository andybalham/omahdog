import fs from 'fs';
import YAML from 'yaml';
import path from 'path';
import { YAMLMap, Scalar } from 'yaml/types';

export abstract class SAMTemplateGenerator {

    generate(workspaceFolderName: string, baseTemplateFileName: string, processedTemplateFileName: string): void {

        const baseTemplateFilePath = path.join(workspaceFolderName, baseTemplateFileName);
        const baseTemplateContent = fs.readFileSync(baseTemplateFilePath, 'utf8');

        const template = YAML.parse(baseTemplateContent);

        const services = template.Services;

        services.MyFunction = {
            Type: 'AWS::Serverless::Function'
        };

        const processedTemplateContent = YAML.stringify(template);
        const processedTemplateFilePath = path.join(workspaceFolderName, processedTemplateFileName);
        fs.writeFileSync(processedTemplateFilePath, processedTemplateContent);

        return;

        const templateYaml = YAML.parseDocument(baseTemplateContent);

        // TODO 19May20: Process the template

        const parametersMap = templateYaml.get('Parameters') as YAMLMap;

        for (const parameter of parametersMap.items) {

            const defaultValue = (parameter.value as YAMLMap).get('Default');
            console.log(`${parameter.key.value}=${defaultValue}`);
        }
        
        console.log(parametersMap.toString());

        const servicesMap = templateYaml.get('Services') as YAMLMap;

        servicesMap.set('MyFunctionName', new Scalar('ApiStageName'));

        // https://eemeli.org/yaml/#creating-documents
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-sub.html
        // https://www.fischco.org/technica/2017/cloud-formation-sub/

        // const processedTemplateContent = templateYaml.toString();
        // const processedTemplateFilePath = path.join(workspaceFolderName, processedTemplateFileName);
        // fs.writeFileSync(processedTemplateFilePath, processedTemplateContent);
    }
}