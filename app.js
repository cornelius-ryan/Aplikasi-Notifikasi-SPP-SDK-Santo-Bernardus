// ==========================================
// 1. INISIALISASI KONEKSI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://xlgnbgjlxpfukyredibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ25iZ2pseHBmdWt5cmVkaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDQ4NDMsImV4cCI6MjEwMTM4MDg0M30.-6XK60RL0kz2U2diE5V8-Niphg2X1dWk8eIKvMB3_NY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabel Global
let daftarAntrean = [];
let indeksSaatIni = 0;
let roleUserSaatIni = ''; // Menyimpan hak akses (admin/guru)

// ==========================================
// 2. AUTENTIKASI & PROFIL
// ==========================================
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const tombol = document.querySelector('#login-section button');
    
    tombol.innerText = 'Memproses...';
    document.getElementById('pesan-error').innerText = '';

    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        document.getElementById('pesan-error').innerText = "Login gagal: " + error.message;
        tombol.innerText = 'Masuk';
    } else {
        tampilkanDashboard(data.user.id);
    }
}

async function logout() {
    await db.auth.signOut();
    window.location.reload();
}

async function tampilkanDashboard(userId) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'flex';

    const { data: profil, error: errorProfil } = await db.from('profiles').select('*').eq('id', userId).single();
    
    if (errorProfil || !profil) {
        alert("Gagal memuat profil. Pastikan akun terdaftar di tabel profiles.");
        return;
    }

    // Simpan role ke variabel global untuk digunakan di dalam bukaMenu()
    roleUserSaatIni = profil.role; 

    document.getElementById('nama-user').innerText = profil.nama;
    document.getElementById('role-user').innerText = roleUserSaatIni.toUpperCase();

    // Tampilkan/Sembunyikan menu samping (Sidebar) berdasarkan hak akses
    if (roleUserSaatIni === 'admin') {
        document.getElementById('btn-menu-tagihan').style.display = 'block';
        document.getElementById('btn-menu-siswa').style.display = 'block';
        document.getElementById('btn-menu-guru').style.display = 'block';
    } else {
        document.getElementById('btn-menu-tagihan').style.display = 'none';
        document.getElementById('btn-menu-siswa').style.display = 'none';
        document.getElementById('btn-menu-guru').style.display = 'none';
    }
    
    // Tarik dan tampilkan halaman pertama (Otomatis akan memuat data sesuai HTML yang ditarik)
    bukaMenu('page-home');
}

// ==========================================
// 3. NAVIGASI HALAMAN (MODULAR SPA)
// ==========================================
async function bukaMenu(idHalaman) {
    // 1. Matikan warna aktif di semua tombol menu sidebar
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('menu-aktif'));
    
    // 2. Beri warna biru pada tombol yang sedang diklik
    const idTombol = 'btn-menu-' + idHalaman.replace('page-', '');
    const tombolAktif = document.getElementById(idTombol);
    if (tombolAktif) tombolAktif.classList.add('menu-aktif');

    // 3. Tangkap wadah area konten utama
    const kontenArea = document.getElementById('main-content');
    kontenArea.innerHTML = '<p style="text-align: center; color: #64748b; margin-top: 50px;">Memuat halaman...</p>';

    try {
        // 4. Tarik file HTML pecahan (Gunakan timestamp otomatis agar tidak terhalang cache browser)
        const response = await fetch(`${idHalaman}.html?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error("File halaman tidak ditemukan di server GitHub.");
        
        // 5. Ubah respon menjadi teks HTML dan suntikkan ke dalam layar DOM
        const htmlCode = await response.text();
        kontenArea.innerHTML = htmlCode;

        // 6. JALANKAN FUNGSI PENARIK DATA HANYA SETELAH HTML BERHASIL DISUNTIKKAN
        if (idHalaman === 'page-home') {
            if (roleUserSaatIni === 'admin') {
                document.getElementById('panel-statistik-admin').style.display = 'grid';
                document.getElementById('panel-guru').style.display = 'none';
                muatStatistikDashboard();
            } else {
                document.getElementById('panel-statistik-admin').style.display = 'none';
                document.getElementById('panel-guru').style.display = 'block';
                muatDaftarSiswaGuru();
            }
        } else if (idHalaman === 'page-tagihan') {
            muatDataTagihan('BELUM_BAYAR');
        } else if (idHalaman === 'page-siswa') {
            muatDataSiswa();
        } else if (idHalaman === 'page-guru') {
            muatDataGuru();
        }

    } catch (error) {
        console.error("Error muat halaman:", error);
        kontenArea.innerHTML = `<p style="color: red; text-align: center; margin-top: 50px;">Gagal memuat sistem: ${error.message}</p>`;
    }
}

// ==========================================
// 4. MODUL DASHBOARD & STATISTIK
// ==========================================
async function muatStatistikDashboard() {
    const { count: jumlahSiswa } = await db.from('siswa').select('*', { count: 'exact', head: true });
    document.getElementById('stat-total-siswa').innerText = jumlahSiswa || 0;

    const { count: jumlahBelumBayar } = await db.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'BELUM_BAYAR');
    document.getElementById('stat-total-tunggakan').innerText = jumlahBelumBayar || 0;

    const { count: jumlahLunas } = await db.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'LUNAS');
    document.getElementById('stat-total-lunas').innerText = jumlahLunas || 0;
}

async function muatDaftarSiswaGuru() {
    const { data: siswa } = await db.from('siswa').select('*');
    const listSiswa = document.getElementById('daftar-siswa');
    listSiswa.innerHTML = '';
    
    if(siswa && siswa.length > 0) {
        siswa.forEach(s => {
            listSiswa.innerHTML += `<li><span class="badge-role">${s.kode_kelas}</span> ${s.nama} - NIS: ${s.nis}</li>`;
        });
    } else {
        listSiswa.innerHTML = '<li style="color: #64748b;">Belum ada data siswa di kelas Anda.</li>';
    }
}

// ==========================================
// 5. MODUL TAGIHAN & WA
// ==========================================
async function muatDataTagihan(statusTarget = 'BELUM_BAYAR') {
    const { data, error } = await db.from('tagihan_spp')
        .select(`id, bulan_tagihan, nominal, status, siswa ( nama, kode_kelas, no_wa_ortu )`)
        .eq('status', statusTarget)
        .order('bulan_tagihan', { ascending: false });

    const tbody = document.getElementById('tabel-tunggakan');
    tbody.innerHTML = '';
    document.getElementById('check-all').disabled = (statusTarget === 'LUNAS');
    
    if(data) {
        data.forEach(row => {
            let tombolAksi = statusTarget === 'BELUM_BAYAR' 
                ? `<button onclick="ubahStatusTagihan('${row.id}', 'LUNAS')" class="btn-hijau" style="padding: 6px 12px; font-size: 12px;">Tandai Lunas</button>`
                : `<button onclick="ubahStatusTagihan('${row.id}', 'BELUM_BAYAR')" class="btn-merah" style="padding: 6px 12px; font-size: 12px;">Batal Lunas</button>`;
            
            let kotakCentang = statusTarget === 'BELUM_BAYAR'
                ? `<input type="checkbox" class="chk-item" data-nama="${row.siswa.nama}" data-wa="${row.siswa.no_wa_ortu}" data-nominal="${row.nominal}" data-bulan="${row.bulan_tagihan}">`
                : `<input type="checkbox" disabled>`;
            
            let warnaBadge = statusTarget === 'LUNAS' ? '#10b981' : '#f59e0b';

            tbody.innerHTML += `
                <tr>
                    <td class="col-center">${kotakCentang}</td>
                    <td>${row.siswa.nama}</td>
                    <td><span class="badge-role" style="background:#e2e8f0; color:#475569;">${row.siswa.kode_kelas}</span></td>
                    <td>${row.bulan_tagihan}</td>
                    <td style="font-weight: 500;">Rp${row.nominal.toLocaleString('id-ID')}</td>
                    <td><span style="background-color: ${warnaBadge}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${statusTarget}</span></td>
                    <td>${tombolAksi}</td>
                </tr>
            `;
        });
    }
}

async function generateTagihanMassal() {
    const inputBulan = document.getElementById('input-bulan-tagihan').value; 
    if (!inputBulan) return alert("Pilih bulan dan tahun dahulu.");
    
    const bulanTagihanLengkap = inputBulan + "-01";
    if (!confirm(`Generate tagihan massal periode ${bulanTagihanLengkap.toUpperCase()} untuk SEMUA siswa aktif?`)) return;

    const { data: listSiswa, error: errorSiswa } = await db.from('siswa').select('id, nominal_spp');
    if (errorSiswa || !listSiswa) return alert("Gagal memuat data siswa.");

    const tagihanBaru = listSiswa.map(s => ({
        siswa_id: s.id,
        bulan_tagihan: bulanTagihanLengkap,
        nominal: s.nominal_spp || 150000, 
        status: 'BELUM_BAYAR'
    }));

    const { error } = await db.from('tagihan_spp').insert(tagihanBaru);
    if (error) {
        alert("Gagal (mungkin tagihan bulan ini sudah pernah dibuat): " + error.message);
    } else { 
        alert(`Berhasil generate tagihan massal periode ${bulanTagihanLengkap}!`); 
        muatDataTagihan('BELUM_BAYAR'); 
    }
}

async function ubahStatusTagihan(idTagihan, statusBaru) {
    let pesan = statusBaru === 'LUNAS' ? 'Tandai sebagai SUDAH DIBAYAR?' : 'Batalkan lunas dan kembalikan ke MENUNGGAK?';
    if (!confirm(pesan)) return;

    const tgl = statusBaru === 'LUNAS' ? new Date().toISOString() : null;
    const { error } = await db.from('tagihan_spp').update({ status: statusBaru, tanggal_bayar: tgl }).eq('id', idTagihan);

    if (error) alert("Gagal update: " + error.message);
    else muatDataTagihan(statusBaru === 'LUNAS' ? 'BELUM_BAYAR' : 'LUNAS');
}

function centangSemua() {
    const master = document.getElementById('check-all').checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = master);
}

function siapkanAntrean() {
    daftarAntrean = []; indeksSaatIni = 0;
    const mapAntrean = new Map();

    document.querySelectorAll('.chk-item:checked').forEach(chk => {
        const { nama, wa, nominal, bulan } = chk.dataset;
        if (mapAntrean.has(wa)) {
            let data = mapAntrean.get(wa);
            data.nominal += Number(nominal);
            data.bulan.push(bulan);
        } else {
            mapAntrean.set(wa, { nama, wa, nominal: Number(nominal), bulan: [bulan] });
        }
    });

    daftarAntrean = Array.from(mapAntrean.values());
    if (daftarAntrean.length === 0) return alert("Centang minimal satu siswa.");
    
    document.getElementById('antrean-panel').style.display = 'block';
    updateLayarAntrean();
}

function updateLayarAntrean() {
    const status = document.getElementById('status-antrean');
    const btn = document.getElementById('btn-kirim-wa');

    if (indeksSaatIni < daftarAntrean.length) {
        let t = daftarAntrean[indeksSaatIni];
        status.innerHTML = `Mengirim pesan <b>${indeksSaatIni + 1} dari ${daftarAntrean.length}</b><br>Tujuan: <b>${t.nama}</b> (${t.wa})`;
        btn.innerText = `Kirim Pesan ke-${indeksSaatIni + 1}`;
        btn.style.display = 'inline-block';
    } else {
        status.innerHTML = `<span style="color: green; font-weight: bold;">Selesai!</span> Semua pesan diproses.`;
        btn.style.display = 'none';
    }
}

function kirimWaSekarang() {
    const target = daftarAntrean[indeksSaatIni];
    const daftarBulan = target.bulan.join(' & ');
    
    const teksPesan = `Halo Bapak/Ibu Wali Murid dari *${target.nama}*,\n\nIni pengingat dari sekolah bahwa tagihan SPP bulan *${daftarBulan}* total *Rp${target.nominal.toLocaleString('id-ID')}* belum diselesaikan.\n\nMohon segera melakukan pembayaran. Terima kasih.`;
    
    window.open(`https://wa.me/${target.wa}?text=${encodeURIComponent(teksPesan)}`, '_blank');
    indeksSaatIni++;
    updateLayarAntrean();
}

function batalAntrean() { 
    document.getElementById('antrean-panel').style.display = 'none'; 
    daftarAntrean = []; 
}

// ==========================================
// 6. MODUL SISWA & BULK ADD
// ==========================================
async function muatDataSiswa() {
    const { data, error } = await db.from('siswa').select('*').order('kode_kelas').order('nama');
    const tbody = document.getElementById('tabel-data-siswa');
    tbody.innerHTML = '';

    if (error) return tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    if (!data || data.length === 0) return tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada data siswa.</td></tr>`;

    data.forEach((s, idx) => {
        tbody.innerHTML += `
            <tr>
                <td class="col-center">${idx + 1}</td>
                <td>${s.nis}</td>
                <td style="font-weight: 500;">${s.nama}</td>
                <td><span class="badge-role" style="background:#e2e8f0; color:#475569;">${s.kode_kelas}</span></td>
                <td>${s.no_wa_ortu}</td>
                <td>
                    <button onclick="bukaFormEdit('${s.id}', '${s.nis}', '${s.nama}', '${s.kode_kelas}', '${s.no_wa_ortu}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px; margin-right: 5px;">Edit</button>
                    <button onclick="hapusSiswa('${s.id}')" class="btn-merah" style="padding: 5px 10px; font-size: 12px;">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function bukaFormEdit(id, nis, nama, kelas, wa) {
    document.getElementById('edit-id-siswa').value = id;
    document.getElementById('edit-nis').value = nis;
    document.getElementById('edit-nama').value = nama;
    document.getElementById('edit-kelas').value = kelas;
    document.getElementById('edit-wa').value = wa;
    document.getElementById('form-edit-container').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function tutupFormEdit() { 
    document.getElementById('form-edit-container').style.display = 'none'; 
}

async function simpanPerubahanSiswa() {
    const id = document.getElementById('edit-id-siswa').value;
    const updateData = { 
        nama: document.getElementById('edit-nama').value, 
        kode_kelas: document.getElementById('edit-kelas').value, 
        no_wa_ortu: document.getElementById('edit-wa').value 
    };
    if (!updateData.nama || !updateData.kode_kelas || !updateData.no_wa_ortu) return alert("Semua kolom wajib diisi!");

    const { error } = await db.from('siswa').update(updateData).eq('id', id);
    if (error) alert("Error update: " + error.message);
    else { 
        alert("Berhasil diperbarui!"); 
        tutupFormEdit(); 
        muatDataSiswa(); 
    }
}

async function hapusSiswa(id) {
    if (!confirm("Yakin ingin menghapus siswa ini? Seluruh riwayat tagihannya juga akan ikut terhapus!")) return;
    const { error } = await db.from('siswa').delete().eq('id', id);
    if (error) alert("Gagal hapus: " + error.message);
    else muatDataSiswa();
}

function downloadFormatCSV() {
    const csv = "data:text/csv;charset=utf-8,nis,nama,kode_kelas,no_wa_ortu,nominal_spp\n2026001,Budi Santoso,5-A,6281234567890,150000\n";
    const link = document.createElement("a"); 
    link.href = encodeURI(csv); 
    link.download = "Format_Import_Siswa_SPP.csv";
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}

function uploadCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const text = e.target.result;
        const baris = text.split("\n");
        const dataSiswaBaru = [];
        
        for (let i = 1; i < baris.length; i++) {
            if (baris[i].trim() === "") continue;
            const kolom = baris[i].split(",");
            if (kolom.length >= 5) {
                dataSiswaBaru.push({ 
                    nis: kolom[0].trim(), 
                    nama: kolom[1].trim(), 
                    kode_kelas: kolom[2].trim(), 
                    no_wa_ortu: kolom[3].trim(), 
                    nominal_spp: Number(kolom[4].trim()) 
                });
            }
        }
        
        if (dataSiswaBaru.length > 0) {
            if (confirm(`Terbaca ${dataSiswaBaru.length} data siswa dari file. Lanjutkan simpan ke database?`)) {
                const { error } = await db.from('siswa').insert(dataSiswaBaru);
                if (error) {
                    alert("Gagal mengimpor data: " + error.message);
                } else {
                    alert("Berhasil mengimpor seluruh data siswa!");
                    muatDataSiswa(); // Refresh tabel
                }
            }
        } else {
            alert("Tidak ada data yang valid untuk diimpor. Pastikan format CSV dipisahkan koma.");
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

// ==========================================
// 7. MODUL GURU & FILTER DATA
// ==========================================
async function muatDataGuru() {
    const { data, error } = await db.from('profiles').select('*').order('nama');
    const tbody = document.getElementById('tabel-data-guru');
    tbody.innerHTML = '';

    if (error) return tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    
    data.forEach((g, idx) => {
        let badge = g.role === 'admin' 
            ? `<span style="background: #ef4444; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">ADMIN</span>`
            : `<span style="background: #3b82f6; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">WALI KELAS</span>`;
        
        tbody.innerHTML += `
            <tr>
                <td class="col-center">${idx + 1}</td>
                <td style="font-weight: 500;">${g.nama || '-'}</td>
                <td>${g.email || '-'}</td>
                <td>${badge}</td>
                <td><span style="color: #10b981; font-size: 13px; font-weight: bold;">Aktif ✓</span></td>
            </tr>
        `;
    });
}

function filterTabelTagihan() {
    const keyword = document.getElementById('cari-tagihan').value.toLowerCase();
    const kelasPilihan = document.getElementById('filter-kelas-tagihan').value;
    const rows = document.querySelectorAll('#tabel-tunggakan tr');
    
    rows.forEach(row => {
        if (row.cells.length < 3) return;
