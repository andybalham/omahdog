import { SAMTemplateGenerator } from './omahdog-aws/SAMTemplateGenerator';

class AwsSequentialFunctionsSAMTemplateGenerator extends SAMTemplateGenerator {

}

const args = process.argv.slice(2);
const workspaceFolderName = args[0];
const generator = new AwsSequentialFunctionsSAMTemplateGenerator();

generator.generate(workspaceFolderName, 'templateBase.yaml', 'templateProcessed.yaml');