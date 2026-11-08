import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return {name:"Pubbblic",short_name:"Pubbblic",description:"Press release distribution, reimagined",start_url:"/",display:"standalone",background_color:"#f7f7f5",theme_color:"#204ce5",icons:[{src:"/favicon.svg",sizes:"any",type:"image/svg+xml"}]}; }
