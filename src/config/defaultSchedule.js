const defaultSchedule = {
	duration: 80,
	breaks: [10, 20, 10, 10],
	start_time: '08:30',
	auto_save: 60,
	repeat: 1,
	starting_week: '2025-08-18',
	theme: ['dark', 'red'],
	subjects: [
		{
			id: 1,
			name: 'Mathematics',
			fullName: "Вища математика. Диференціальні рівняння",
			teacher: 2,
			links: [1, 2],
			status: "offline",
			type: "Лекція",
			building: "Головний",
			room: "201",
			color: 'red',
			gradient: { type: "linear", angle: 90, colors: ["red"] }
		},
		{
			id: 2,
			name: 'Ukrainian Language',
			teacher: 1,
			color: 'blue',
		},
		{
			id: 3,
			name: 'Biology',
			teacher: 4,
			color: 'green',
		},
		{
			id: 4,
			name: 'Physics',
			teacher: 5,
			color: 'yellow',
		},
		{
			id: 5,
			name: 'Informatics',
			teacher: 3,
			color: 'purple',
		},
	],
	teachers: [
		{
			id: 1,
			name: 'John Doe',
			phone: '09340001',
		},
		{
			id: 2,
			name: 'Jane Smith',
			phone: '09340002',
		},
		{
			id: 3,
			name: 'Mark Brown',
			phone: '09340003',
		},
		{
			id: 4,
			name: 'Emily White',
			phone: '09340004',
		},
		{
			id: 5,
			name: 'Alice Green',
			phone: '09340005',
		},
	],
	links: [
		{ id: 1, name: 'Zoom Math', url: 'https://zoom.com/lesson1' },
		{ id: 2, name: 'Zoom Ukrainian', url: 'https://zoom.com/lesson2' },
		{ id: 3, name: 'Zoom Biology', url: 'https://zoom.com/lesson3' },
		{ id: 4, name: 'Zoom Physics', url: 'https://zoom.com/lesson4' },
		{ id: 5, name: 'Zoom Informatics', url: 'https://zoom.com/lesson5' },
	],
	statuses: [
	    { id: 1, name: "offline", color: "red" },
	    { id: 2, name: "online", color: "green" },
	    { id: 3, name: "hybrid", color: "blue" },
	],
	schedule: Array.from({ length: 7 }, () => ({
	  week1: [],
	  week2: [],
	  week3: [],
	  week4: [],
	})),

}

export default defaultSchedule
