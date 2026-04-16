# 🍜 VietFoodVQA Annotation Tool

**VietFoodVQA** is a high-performance web application designed for annotating and verifying Vietnamese Food Visual Question Answering (VQA) datasets and Knowledge Graph (KG) Triples. 

Originally built in Streamlit, this modernized iteration is rewritten using **Astro**, **Tailwind CSS**, and **Vanilla TypeScript SPAs** for lightning-fast performance, low-latency API interactions, and a beautiful glassmorphic UI.

## ✨ Features
- **⚡ High Performance**: Replaced the heavy backend-rendering loop of Python/Streamlit with statically served SPAs and targeted server-side API endpoints (`@astrojs/node`).
- **🎨 Glassmorphic Interface**: Fully themed with Tailwind CSS and Inter typography for a premium, distraction-free annotation environment.
- **🖼️ Image Verification**: Review food items, flag droppable images, and review dataset integrity directly.
- **💬 VQA Verification**: Review Question/Answer pairs, examine their rationale, and tie them directly to underlying KG triples in the dataset.
- **🔗 KG Triple Verification**: Range-based subset loading for massive triple catalogs, allowing lightning-fast filtering by Relation, Drop-state, and Validity.
- **💾 Supabase Integration**: Seamless PostgreSQL synchronization natively managed by the application.

## 🚀 Tech Stack
- **Framework**: [Astro](https://astro.build/) (SSR via `@astrojs/node`)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Package Manager / Runtime**: [Bun](https://bun.sh/)

## 🛠️ Setup & Installation

**1. Clone and Install Dependencies:**
```bash
# Make sure you have Bun installed
bun install
```

**2. Configure Environment Variables:**
Create a `.env` file in the root of the project with your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```
*(Note: If utilizing Legacy keys from Streamlit, they can also simply be deposited here).*

**3. Run the Development Server:**
```bash
bun run dev
```

The application will be available at [http://localhost:4321](http://localhost:4321). All routing dynamically redirects to `/verify-images` by default!

## 📂 Project Structure
```
.
├── .env                # Secret environment variables (Supabase Keys)
├── src/
│   ├── layouts/        # Shared Astro layouts (Tailwind CSS global definitions)
│   ├── pages/          # Astro Application Routes
│   │   ├── api/        # Server-Side API Endpoints handling direct Supabase queries
│   │   ├── *.astro     # The UI route shells for Image, VQA, and Triple tabs
│   │   └── index.astro # Base redirect
│   ├── scripts/        # Vanilla TypeScript SPAs (The core browser logic for fetching/saving)
│   └── lib/            # Shared Utilities and Database abstractions
├── Legacy/             # The old Streamlit Python codebase (for theoretical reference)
├── astro.config.mjs    # Astro build configuration
└── tailwind.config.mjs # Tailwind CSS design configuration
```

## 📦 Deployment
This project is configured to be built via Node. It outputs to a `dist/` directory containing client and server assets.
```bash
bun run build
```
*(A `netlify.toml` profile is included out of the box if you intend to deploy to Netlify Edge / Node environments).*
