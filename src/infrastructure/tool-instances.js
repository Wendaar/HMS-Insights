import {neon} from '@neondatabase/serverless';
export const toolSchema=`create table if not exists hms_tool_instances (
  tool text not null, organization text not null, slug text not null,
  draft jsonb not null, published jsonb, revision integer not null default 1,
  updated_at timestamptz not null default now(), published_at timestamptz,
  primary key (tool, organization, slug)
)`;
const decode=row=>row?{draft:row.draft,published:row.published,revision:row.revision,updatedAt:row.updated_at,publishedAt:row.published_at}:null;
export function toolStore({env=process.env,sql,tool='playoff-players'}={}){
  const query=async(text,values=[])=>{
    if(!sql&&!env.DATABASE_URL)throw new Error('Storage unavailable');
    return (sql??neon(env.DATABASE_URL)).query(text,values);
  };
  return {
    async get(org,slug){
      if(!sql&&!env.DATABASE_URL)return null;
      try{return decode((await query('select draft,published,revision,updated_at,published_at from hms_tool_instances where tool=$1 and organization=$2 and slug=$3',[tool,org,slug]))[0]);}
      catch(error){if(error.code==='42P01')return null;throw error;}
    },
    async list(org){
      if(!sql&&!env.DATABASE_URL)return [];
      try{return await query("select slug,draft->>'title' as title,revision,published is not null as published from hms_tool_instances where tool=$1 and organization=$2 order by updated_at desc limit 100",[tool,org]);}
      catch(error){if(error.code==='42P01')return [];throw error;}
    },
    async save(org,slug,draft,revision,bootstrap){
      // Schema creation is reached only after authorization in the handler.
      await query(toolSchema);
      const args=[tool,org,slug,JSON.stringify(draft),revision];
      const rows=revision===0?await query(`insert into hms_tool_instances (tool,organization,slug,draft,published)
        values ($1,$2,$3,$4::jsonb,$5::jsonb) on conflict do nothing returning *`,[...args.slice(0,4),bootstrap?JSON.stringify(bootstrap.published):null]):
        await query(`update hms_tool_instances set draft=$4::jsonb,revision=revision+1,updated_at=now()
        where tool=$1 and organization=$2 and slug=$3 and revision=$5 returning *`,args);
      return decode(rows[0]);
    },
    async unpublish(org,slug,revision){
      return decode((await query(`update hms_tool_instances set published=null,published_at=null,revision=revision+1,updated_at=now()
        where tool=$1 and organization=$2 and slug=$3 and revision=$4 returning *`,[tool,org,slug,revision]))[0]);
    },
    async publish(org,slug,revision){
      return decode((await query(`update hms_tool_instances set published=draft,revision=revision+1,published_at=now(),updated_at=now()
        where tool=$1 and organization=$2 and slug=$3 and revision=$4 returning *`,[tool,org,slug,revision]))[0]);
    },
  };
}
