import { LinkPreset, type NavBarLink } from "@/types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	[LinkPreset.About]: {
		name: "关于我们",
		url: "/about/",
		icon: "material-symbols:person",
	},
	[LinkPreset.Archive]: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	[LinkPreset.Friends]: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:group",
	},
	[LinkPreset.Anime]: {
		name: "追番",
		url: "/anime/",
		icon: "material-symbols:movie",
	},
	[LinkPreset.Diary]: {
		name: "日记",
		url: "/diary/",
		icon: "material-symbols:book",
	},
	[LinkPreset.Gallery]: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
	},
	[LinkPreset.Projects]: {
		name: "项目展示",
		url: "/projects/",
		icon: "material-symbols:work",
	},
	[LinkPreset.Skills]: {
		name: "技能展示",
		url: "/skills/",
		icon: "material-symbols:psychology",
	},
	[LinkPreset.Timeline]: {
		name: "时间线",
		url: "/timeline/",
		icon: "material-symbols:timeline",
	},
};
