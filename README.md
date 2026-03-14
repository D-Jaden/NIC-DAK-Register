![logo](https://github.com/D-Jaden/DAK-Register/blob/main/public/images/NIC-Logo-white.png)
# NIC DAK LOGBOOK

--------------------------------------------------------
## ABOUT THE PROJECT 
It is a **web-based logbook system** designed to manage and track **Deliverd** and **Acquired** records efficiently.  
The application provides a **secure login and registration system**, intuitive data management tables, and advanced features such as sorting, filtering, inline editing, and PDF viewing — all in one streamlined interface.  

Users can register with their basic details, log in securely, and seamlessly switch between Despatch and Acquired tables. Each account maintains its own data, ensuring personalized access and record persistence.

## TECH STACK

![HTML](https://img.shields.io/badge/HTML-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Hugging Face](https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)

## CONTENT

## PROJECT STRUCTURE
```
.
├── package.json
├── package-lock.json
├── public
│   ├── auth.js
│   ├── dak_acquired.html
│   ├── dak_acquired.js
│   ├── dak_acquired_styles.css
│   ├── dak_despatch.html
│   ├── dak_despatch.js
│   ├── dak_despatch_styles.css
│   ├── dashboard_acquired.html
│   ├── dashboard_acquired.js
│   ├── dashboard.html
│   ├── dashboard.js
│   ├── dashboard_styles.css
│   ├── images
│   │   ├── captcha.png
│   │   ├── closed-eye.png
│   │   ├── digital-india.png
│   │   ├── NIC Logo JPG
│   │   │   ├── BILINGUAL FULL LENGTH VERSION  blue bg-01.jpg
│   │   │   ├── BILINGUAL FULL LENGTH VERSION  sans bg-01.jpg
│   │   │   ├── BILINGUAL FULL LENGTH VERSION white  bg-01.jpg
│   │   │   ├── BILINGUAL _SQUARE_NIC_Logo_blue_bg-01.jpg
│   │   │   ├── BILINGUAL _SQUARE_NIC_Logo_white_bg-01.jpg
│   │   │   ├── ICONIC_SQUARE_NIC_Logo_blue_bg-01.jpg
│   │   │   ├── ICONIC_SQUARE_NIC_Logo_white_bg-01.jpg
│   │   │   ├── NIC_Logo1-01.jpg
│   │   │   ├── NIC logo 1 Bilingual Blue 1-01.jpg
│   │   │   ├── NIC logo 1 Bilingual sans.jpg
│   │   │   ├── NIC logo 1 Bilingual white 1-01.jpg
│   │   │   ├── Nic_logo2-01.jpg
│   │   │   └── Nic_logo3-01.jpg
│   │   ├── NIC-Logo-white.png
│   │   ├── open-book.png
│   │   └── open-eye.png
│   ├── login.html
│   ├── login.js
│   ├── login_styles.css
│   ├── shared.js
│   └── terms.html
├── routes
│   ├── acquiredRoutes.js
│   ├── despatchRoutes.js
│   └── userRoutes.js
├── server.js
├── server.log
├── test_stats_auth.js
└── utils
    ├── auth.js
    ├── db.js
    ├── helpers.js
    └── initDatabase.js
```

## WHAT TO INSTALL ?
Make sure you have the following installed before running the project:  

- **Node.js** (v16 or above)
- **Express.js**
- **PostgreSQL** (latest version recommended)  
- **npm**
- **VSCode** or any IDE to run javascript

## HOW TO RUN ?
- ```git clone https://github.com/D-Jaden/DAK-Register```
- In PostgreSQL create the DB called dak via this command (`CREAT DATABASE dak;`)
- ```cd DAK-Register```
- ```npm run dev``` (make sure you have insaleed the necessary npm packages mentioned in the node_modules)
- The tables are automatically created via the initDatabase.js
- Go to http://localhost:3000 (or the PORT number of your choice)
- Don't forget to read each folder for better understanding for the database,routes,and node modules 

## FEATURES
### Authentication  
- User **Registration** with:
  - First Name, Last Name, Phone Number fields.
  - Captcha verification and Agreement checkbox.
- **Login** using registered Phone Number.
- Input validation ensures:
  - Only numeric values are accepted in the phone number field.
  - Duplicate accounts are not created even if the name is capitalized differently or if the number already exsts.
- Registered data is securely stored and retrieved for each user.

---

### Logbook Interface  
- Two separate tables: **Delivered** and **Acquired**.
- A **Switch Button** allows toggling between the two tables easily.
- Both tables share the same functionalities:
  - **Text Formatting Tools** — change font size, style, bold, italic, and underline text.
  - **Find & Replace** functionality for quick editing.
  - **Dynamic Row Display** — view up to 100 rows (default: 6).
  - **Inbuilt PDF Viewer** to preview exported or related documents directly in the app.
  - **A Dashboard** dedicated for the analytics of each table
    - Total Lettes sent
    - Total Letters sent via a particular language
    - Total Letters sent to a Zone
    - Total Letters sent via a particular language to a specific zone   
  - **Search and Filter Columns** with ascending and descending sorting.
  - **Add Row Button** to insert new rows.
  - **Right-click Menu** to:
    - Add a row above or below.
    - Delete selected rows.
- When a user logs in, all previously saved Delivered and Acquired data is automatically loaded from their account accordingly.

---

## Database  

- The project uses **PostgreSQL** for backend data storage.  
- All user registration details and table data are saved securely in the database.  
- Existing **database setup and configuration instructions** are provided in the repository.  
- Key aspects:
  - Each user’s Delivered and Acquired records are stored separately.
  - Ensures persistent and reliable data retrieval upon login.
  - Supports structured data management for scalability and multi-user handling.

---
## TRANSLATION MODEL
### KUTRIM AI LAB

### Translation Score
IN22-Gen English to Indic
| Language | Krutrim |
|---------|---------|
| Hindi   | 54.4    |

## FUTURE UPDATES

Planned future enhancements include:

- **Dark Mode UI** for better accessibility and aesthetics.  
- **Role-Based Access Control (RBAC)** — separate permissions for Admins and Users.  
- **Export Options** — ability to export data as Excel or CSV files.  
- **Notification System** — instant alerts for new entries or updates.    
- **Auto-Save Feature** — periodic data saving to prevent accidental loss.  
- **Enhanced Security** — improved password encryption and validation logic.
- **Better Responsiveness** — ability to respond to different devices better
- **Better PDF View** — A modern way of viewing the table in PDF Format
- **Status Update** - If a letter was successfully acquired and delivered {Status goes from Pending -> Acquired} which has to be done from the department/recipient that received it (via a radio button or checkbox)
- **Real Time Collaboration** - Multiple users can view and edit documents simultaneously with live updates (Key or like add collaborators via phonenumber etc) 
- **Version Control** - Allows you to retrieve prev file if a crash occurs
- **Offline Editing** - Allow users to edit in the offline mode with the translation which has a small cache (i.e limited translation)
---
