// Supabase Client Initialization
const SUPABASE_URL = 'https://wqxirepowxepclatszge.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeGlyZXBvd3hlcGNsYXRzemdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzM4NjEsImV4cCI6MjA5Nzc0OTg2MX0.7I8YTBhPDqiOQ2xpqxyZmWzO012uFooEgomB-mtlJvA';

// Check if running in mock simulation mode (file://, localhost, 127.0.0.1, local IP or offline)
const isMockMode = window.location.protocol === 'file:' || 
                   window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.startsWith('192.168.') ||
                   !window.supabase;

window.isMockMode = isMockMode;

// Safe LocalStorage wrapper to prevent crash if disabled/blocked on file:// or sandbox
const safeLocalStorage = {
    _memoryStore: {},
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return this._memoryStore[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            this._memoryStore[key] = value;
        }
    }
};

var supabase;

if (isMockMode) {
    console.log("Aula Forma: Ejecutando en modo simulación local. Iniciando base de datos simulada en LocalStorage.");
    
    // Initialize Local Storage mock database if not present
    if (!safeLocalStorage.getItem('db_perfiles')) {
        safeLocalStorage.setItem('db_perfiles', JSON.stringify([{
            id: '00000000-0000-0000-0000-000000000000',
            nombre_completo: 'Docente de Pruebas',
            correo: 'docente.pruebas@aulaforma.cl',
            creditos_disponibles: 15,
            is_admin: true,
            prueba_gratuita_usada: false
        }]));
    }
    if (!safeLocalStorage.getItem('db_compras')) {
        safeLocalStorage.setItem('db_compras', JSON.stringify([]));
    }
    if (!safeLocalStorage.getItem('db_documentos_generados')) {
        safeLocalStorage.setItem('db_documentos_generados', JSON.stringify([]));
    }
    if (!safeLocalStorage.getItem('db_packs_creditos')) {
        safeLocalStorage.setItem('db_packs_creditos', JSON.stringify([
            { id_pack: 1, nombre_pack: 'Pack Prueba', cantidad_creditos: 5, precio: 2990 },
            { id_pack: 2, nombre_pack: 'Pack Inicio', cantidad_creditos: 10, precio: 4990 },
            { id_pack: 3, nombre_pack: 'Pack Docente', cantidad_creditos: 15, precio: 6990 },
            { id_pack: 4, nombre_pack: 'Pack Aula', cantidad_creditos: 30, precio: 11990 },
            { id_pack: 5, nombre_pack: 'Pack Pro', cantidad_creditos: 50, precio: 17990 },
            { id_pack: 6, nombre_pack: 'Pack UTP', cantidad_creditos: 100, precio: 29990 },
            { id_pack: 7, nombre_pack: 'Pack Institucional', cantidad_creditos: 200, precio: 49990 }
        ]));
    }

    class MockSupabaseQueryBuilder {
        constructor(table) {
            this.table = 'db_' + table;
            this.filters = [];
            this.orderBy = null;
            this.isSingle = false;
            this.limitVal = null;
            this.orFilter = null;
            this.operation = 'select'; // select, insert, update
            this.data = null;
        }

        select(columns) {
            this.operation = 'select';
            return this;
        }

        insert(data) {
            this.operation = 'insert';
            this.data = data;
            return this;
        }

        update(data) {
            this.operation = 'update';
            this.data = data;
            return this;
        }

        eq(column, value) {
            this.filters.push({ column, value });
            return this;
        }

        order(column, options) {
            this.orderBy = { column, options };
            return this;
        }

        limit(value) {
            this.limitVal = value;
            return this;
        }

        or(filterStr) {
            this.orFilter = filterStr;
            return this;
        }

        single() {
            this.isSingle = true;
            return this;
        }

        async then(resolve) {
            try {
                const result = await this.execute();
                resolve(result);
            } catch (err) {
                console.error("Error en consulta simulada:", err);
                resolve({ data: null, error: err });
            }
        }

        async execute() {
            let list = JSON.parse(safeLocalStorage.getItem(this.table) || '[]');

            if (this.operation === 'insert') {
                const itemsToInsert = Array.isArray(this.data) ? this.data : [this.data];
                const insertedItems = itemsToInsert.map(item => {
                    const newItem = { ...item };
                    if (this.table === 'db_compras' && !newItem.id_compra) {
                        newItem.id_compra = 'compra-' + Math.random().toString(36).substr(2, 9);
                        newItem.fecha_compra = new Date().toISOString();
                    }
                    if (this.table === 'db_documentos_generados' && !newItem.id_documento) {
                        newItem.id_documento = 'doc-' + Math.random().toString(36).substr(2, 9);
                        newItem.fecha_generacion = new Date().toISOString();
                    }
                    return newItem;
                });

                list.push(...insertedItems);
                safeLocalStorage.setItem(this.table, JSON.stringify(list));

                const responseData = Array.isArray(this.data) ? insertedItems : insertedItems[0];
                return { data: responseData, error: null };
            }

            if (this.operation === 'update') {
                let updatedCount = 0;
                list = list.map(item => {
                    const matches = this.filters.every(f => item[f.column] === f.value);
                    if (matches) {
                        updatedCount++;
                        return { ...item, ...this.data };
                    }
                    return item;
                });
                safeLocalStorage.setItem(this.table, JSON.stringify(list));
                console.log(`Actualizados ${updatedCount} registros simulados en ${this.table}.`);
                return { data: list, error: null };
            }

            // Select
            let filtered = list.filter(item => {
                return this.filters.every(f => item[f.column] === f.value);
            });

            // Fallback: If querying a single profile and it was not found, create a mock profile for this ID
            if (this.table === 'db_perfiles' && filtered.length === 0 && this.isSingle) {
                const idFilter = this.filters.find(f => f.column === 'id');
                if (idFilter && idFilter.value) {
                    const newProfile = {
                        id: idFilter.value,
                        nombre_completo: 'Docente de Pruebas',
                        correo: 'docente.pruebas@aulaforma.cl',
                        creditos_disponibles: 15,
                        is_admin: true,
                        prueba_gratuita_usada: false
                    };
                    list.push(newProfile);
                    safeLocalStorage.setItem('db_perfiles', JSON.stringify(list));
                    filtered = [newProfile];
                    console.log("Mock DB: Perfil creado automáticamente para ID: " + idFilter.value);
                }
            }

            // Join support for perfiles and packs_creditos in compras
            if (this.table === 'db_compras') {
                const perfiles = JSON.parse(safeLocalStorage.getItem('db_perfiles') || '[]');
                filtered = filtered.map(compra => {
                    const perfil = perfiles.find(p => p.id === compra.id_usuario);
                    let nombrePack = 'Pack Prueba';
                    let cantidadCreditos = 5;
                    if (compra.id_pack === 2) { nombrePack = 'Pack Inicio'; cantidadCreditos = 10; }
                    else if (compra.id_pack === 3) { nombrePack = 'Pack Docente'; cantidadCreditos = 15; }
                    else if (compra.id_pack === 4) { nombrePack = 'Pack Aula'; cantidadCreditos = 30; }
                    else if (compra.id_pack === 5) { nombrePack = 'Pack Pro'; cantidadCreditos = 50; }
                    else if (compra.id_pack === 6) { nombrePack = 'Pack UTP'; cantidadCreditos = 100; }
                    else if (compra.id_pack === 7) { nombrePack = 'Pack Institucional'; cantidadCreditos = 200; }
                    
                    return {
                        ...compra,
                        perfiles: perfil || { nombre_completo: 'Docente de Pruebas', correo: 'docente.pruebas@aulaforma.cl' },
                        packs_creditos: {
                            nombre_pack: nombrePack,
                            cantidad_creditos: cantidadCreditos
                        }
                    };
                });
            }

            // Apply search (or) filter if present
            if (this.orFilter) {
                const matches = this.orFilter.match(/ilike\.%([^%]+)%/);
                if (matches && matches[1]) {
                    const search = matches[1].toLowerCase();
                    filtered = filtered.filter(item => {
                        const name = (item.nombre_completo || '').toLowerCase();
                        const email = (item.correo || '').toLowerCase();
                        return name.includes(search) || email.includes(search);
                    });
                }
            }

            if (this.orderBy) {
                const col = this.orderBy.column;
                const ascending = this.orderBy.options?.ascending !== false;
                filtered.sort((a, b) => {
                    if (a[col] < b[col]) return ascending ? -1 : 1;
                    if (a[col] > b[col]) return ascending ? 1 : -1;
                    return 0;
                });
            }

            if (this.limitVal) {
                filtered = filtered.slice(0, this.limitVal);
            }

            if (this.isSingle) {
                return { data: filtered[0] || null, error: null };
            }

            return { data: filtered, error: null };
        }
    }

    supabase = {
        auth: {
            async getSession() {
                const isLoggedOut = safeLocalStorage.getItem('mock_logged_out') === 'true';
                if (isLoggedOut) {
                    return { data: { session: null }, error: null };
                }
                return {
                    data: {
                        session: {
                            user: {
                                id: '00000000-0000-0000-0000-000000000000',
                                email: 'docente.pruebas@aulaforma.cl',
                                user_metadata: {
                                    nombre_completo: 'Docente de Pruebas',
                                    tipo_usuario: 'Docente'
                                }
                            },
                            access_token: 'mock-access-token'
                        }
                    },
                    error: null
                };
            },
            async signInWithPassword({ email, password }) {
                console.log("Mock Sign In successful.");
                safeLocalStorage.setItem('mock_logged_out', 'false');
                return {
                    data: {
                        user: { id: '00000000-0000-0000-0000-000000000000', email }
                    },
                    error: null
                };
            },
            async signUp({ email, password, options }) {
                console.log("Mock Sign Up successful.");
                safeLocalStorage.setItem('mock_logged_out', 'false');
                
                const nombre = options?.data?.nombre_completo || 'Docente de Pruebas';
                const tipo = options?.data?.tipo_usuario || 'Docente';
                const profiles = JSON.parse(safeLocalStorage.getItem('db_perfiles') || '[]');
                const existing = profiles.find(p => p.correo === email);
                if (!existing) {
                    profiles.push({
                        id: '00000000-0000-0000-0000-000000000000',
                        nombre_completo: nombre,
                        correo: email,
                        creditos_disponibles: 15,
                        is_admin: true,
                        prueba_gratuita_usada: false
                    });
                    safeLocalStorage.setItem('db_perfiles', JSON.stringify(profiles));
                }
                
                return {
                    data: {
                        user: { id: '00000000-0000-0000-0000-000000000000', email }
                    },
                    error: null
                };
            },
            onAuthStateChange(callback) {
                return { data: { subscription: { unsubscribe() {} } } };
            },
            async signOut() {
                console.log("Sesión simulada cerrada.");
                safeLocalStorage.setItem('mock_logged_out', 'true');
                return { error: null };
            }
        },
        from(table) {
            return new MockSupabaseQueryBuilder(table);
        }
    };

} else {
    // Real Supabase Client Initialization
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Utility to check session and manage auth state globally
async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error("Error getting session:", error);
    return session;
}

// Global Auth State Change Listener
supabase.auth.onAuthStateChange((event, session) => {
    const authEvent = new CustomEvent('authStateChange', { detail: { event, session } });
    document.dispatchEvent(authEvent);
});

// Utility to get or create user profile fallback
async function getOrCreateProfile(session) {
    if (!session || !session.user) {
        return { profile: null, error: new Error("No hay sesión activa.") };
    }
    
    // 1. Intentar obtener el perfil
    const { data: profile, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
    if (profile) {
        return { profile, error: null };
    }
    
    // Si la tabla no existe o hay otro error grave que no sea "cero filas devueltas" (PGRST116)
    if (error && error.code !== 'PGRST116') {
        return { profile: null, error };
    }
    
    // 2. Si el perfil no existe, intentar crearlo (por si falla el trigger o el usuario es previo a la base de datos)
    console.log("Perfil no encontrado en base de datos. Intentando creación automática vía fallback...");
    const profileToInsert = {
        id: session.user.id,
        correo: session.user.email,
        nombre_completo: session.user.user_metadata?.nombre_completo || 'Usuario',
        tipo_usuario: session.user.user_metadata?.tipo_usuario || 'Docente',
        creditos_disponibles: 1, // crédito gratuito inicial
        prueba_gratuita_usada: true
    };
    
    const { error: insertError } = await supabase
        .from('perfiles')
        .insert(profileToInsert);
        
    if (!insertError) {
        console.log("Perfil creado exitosamente mediante fallback del cliente.");
        return { profile: profileToInsert, error: null };
    }
    
    // Retornamos el error de la inserción o el error original
    return { profile: null, error: insertError || error };
}
