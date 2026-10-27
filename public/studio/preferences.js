export function studioSettingsScope({hasGame=false,choice='',insightType=''}){
  if(!hasGame)return 'default';
  if(choice==='insight'&&insightType)return `insight:${insightType}`;
  return choice?`template:${choice}`:'default';
}

export function studioSettingsKey(organization,scope='default'){
  return `hms-studio:settings:v2:${organization}:${scope}`;
}
