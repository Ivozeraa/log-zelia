import { useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaFileExcel, FaFilePdf, FaPlus, FaSpinner, FaTrash } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabase';