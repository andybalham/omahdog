New-Item -Path .\src\omahdog -ItemType Directory -Force
Get-ChildItem -Path ..\..\packages\omahdog\dist\src -Recurse | Copy-Item -Destination .\src\omahdog -Recurse
New-Item -Path .\dist\omahdog -ItemType Directory -Force
Get-ChildItem -Path ..\..\packages\omahdog\dist\src -Recurse | Copy-Item -Destination .\dist\omahdog -Recurse

# New-Item -Path .\src\omahdog-aws -ItemType Directory -Force
# Get-ChildItem -Path ..\..\packages\omahdog-aws\dist\src -Recurse | Copy-Item -Destination .\src\omahdog-aws -Recurse
# New-Item -Path .\dist\omahdog-aws -ItemType Directory -Force
# Get-ChildItem -Path ..\..\packages\omahdog-aws\dist\src -Recurse | Copy-Item -Destination .\dist\omahdog-aws -Recurse